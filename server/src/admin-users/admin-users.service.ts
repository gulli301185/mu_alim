import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export const statusSchema = z.object({ isActive: z.boolean() });

export const grantEnrollmentSchema = z.object({ courseId: z.string().uuid() });

const USER_NOT_FOUND = 'Колдонуучу табылган жок';

const courseSummarySelect = {
  id: true,
  title: true,
  slug: true,
  courseType: true,
  price: true,
  currency: true,
} as const;

function toPublicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'user' | 'admin';
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function toCourseSummary(course: {
  id: string;
  title: string;
  slug: string;
  courseType: 'free' | 'paid';
  price: Prisma.Decimal;
  currency: string;
}) {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    courseType: course.courseType,
    price: Number(course.price),
    currency: course.currency,
  };
}

function toEnrollmentDto(
  enrollment: { id: string; status: string; enrolledAt: Date; completedAt: Date | null },
  course: Parameters<typeof toCourseSummary>[0],
) {
  return {
    id: enrollment.id,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    completedAt: enrollment.completedAt?.toISOString() ?? null,
    course: toCourseSummary(course),
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private async requireLearner(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'user' } });
    if (!user) throw new AppError(404, USER_NOT_FOUND);
    return user;
  }

  async list({ page, limit, search }: z.infer<typeof listQuerySchema>) {
    const where: Prisma.UserWhereInput = {
      role: 'user',
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { enrollments: true, certificates: true, courseProgress: true } },
        },
      }),
    ]);

    return {
      items: users.map((user) => ({
        ...toPublicUser(user),
        enrollmentsCount: user._count.enrollments,
        certificatesCount: user._count.certificates,
        activeCoursesCount: user._count.courseProgress,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async get(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: 'user' },
      include: {
        enrollments: {
          orderBy: { enrolledAt: 'desc' },
          include: { course: { select: courseSummarySelect } },
        },
        courseProgress: {
          orderBy: { updatedAt: 'desc' },
          include: {
            course: { select: courseSummarySelect },
            lastLesson: { select: { id: true, title: true, lessonOrder: true } },
          },
        },
        certificates: {
          orderBy: { issuedAt: 'desc' },
          include: { course: { select: courseSummarySelect } },
        },
      },
    });
    if (!user) throw new AppError(404, USER_NOT_FOUND);

    return {
      user: toPublicUser(user),
      enrollments: user.enrollments.map((item) => toEnrollmentDto(item, item.course)),
      courseProgress: user.courseProgress.map((item) => ({
        id: item.id,
        progressPercent: Number(item.progressPercent),
        isCompleted: item.isCompleted,
        completedAt: item.completedAt?.toISOString() ?? null,
        updatedAt: item.updatedAt.toISOString(),
        course: toCourseSummary(item.course),
        lastLesson: item.lastLesson
          ? {
              id: item.lastLesson.id,
              title: item.lastLesson.title,
              lessonOrder: item.lastLesson.lessonOrder,
            }
          : null,
      })),
      certificates: user.certificates.map((item) => ({
        id: item.id,
        certificateNumber: item.certificateNumber,
        verificationCode: item.verificationCode,
        issuedAt: item.issuedAt.toISOString(),
        course: toCourseSummary(item.course),
      })),
    };
  }

  /** `alreadyActive` tells the controller to answer 200 instead of 201. */
  async grantEnrollment(userId: string, courseId: string) {
    const user = await this.requireLearner(userId);

    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new AppError(404, 'Курс табылган жок');
    if (course.courseType !== 'paid') {
      throw new AppError(400, 'Бекер курс үчүн төлөм талап кылынбайт');
    }

    const now = new Date();
    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: course.id } },
    });

    if (existing?.status === 'active') {
      return { enrollment: toEnrollmentDto(existing, course), alreadyActive: true };
    }

    const enrollment = await this.prisma.$transaction(async (tx) => {
      const record = existing
        ? await tx.enrollment.update({
            where: { id: existing.id },
            data: {
              status: 'active',
              enrolledAt: existing.enrolledAt,
              completedAt: existing.completedAt,
            },
          })
        : await tx.enrollment.create({
            data: { userId: user.id, courseId: course.id, status: 'active', enrolledAt: now },
          });

      await tx.payment.create({
        data: {
          userId: user.id,
          courseId: course.id,
          amount: course.price,
          currency: course.currency,
          paymentMethod: 'whatsapp',
          transactionId: `whatsapp-${randomUUID()}`,
          status: 'success',
          paidAt: now,
          providerResponse: { source: 'admin_grant' },
        },
      });

      const existingCourseProgress = await tx.courseProgress.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
        select: { id: true },
      });
      if (!existingCourseProgress) {
        await tx.courseProgress.create({
          data: { userId: user.id, courseId: course.id, progressPercent: 0, isCompleted: false },
        });
      }

      return record;
    });

    return { enrollment: toEnrollmentDto(enrollment, course), alreadyActive: false };
  }

  async setStatus(id: string, isActive: boolean) {
    const existing = await this.requireLearner(id);
    const updated = await this.prisma.user.update({ where: { id: existing.id }, data: { isActive } });
    return { user: toPublicUser(updated) };
  }

  async remove(id: string) {
    const existing = await this.requireLearner(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { userId: existing.id } });
      await tx.certificate.deleteMany({ where: { userId: existing.id } });
      await tx.user.delete({ where: { id: existing.id } });
    });

    // Their reviews are cascade-deleted, so the cached public review lists are stale.
    await this.cache.invalidate('reviews:');
    return { ok: true };
  }
}
