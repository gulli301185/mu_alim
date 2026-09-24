import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { CacheService } from '../cache/cache.service';
import {
  Certificate,
  Course,
  CourseProgress,
  Enrollment,
  Payment,
  User,
} from '../database/entities';
import { anyContains } from '../database/sql';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export const statusSchema = z.object({ isActive: z.boolean() });

export const grantEnrollmentSchema = z.object({ courseId: z.string().uuid() });

const USER_NOT_FOUND = 'Колдонуучу табылган жок';

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
  price: number;
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
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    private readonly ds: DataSource,
    private readonly cache: CacheService,
  ) {}

  private async requireLearner(id: string) {
    const user = await this.users.findOneBy({ id, role: 'user' });
    if (!user) throw new AppError(404, USER_NOT_FOUND);
    return user;
  }

  async list({ page, limit, search }: z.infer<typeof listQuerySchema>) {
    const qb = this.users
      .createQueryBuilder('u')
      .where("u.role = 'user'")
      .orderBy('u.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .loadRelationCountAndMap('u.enrollmentsCount', 'u.enrollments')
      .loadRelationCountAndMap('u.certificatesCount', 'u.certificates')
      .loadRelationCountAndMap('u.activeCoursesCount', 'u.courseProgress');
    if (search) {
      qb.andWhere(anyContains(['u.email', 'u.firstName', 'u.lastName', 'u.phone'], 'search', search));
    }

    const [users, total] = (await qb.getManyAndCount()) as unknown as [
      Array<
        User & { enrollmentsCount: number; certificatesCount: number; activeCoursesCount: number }
      >,
      number,
    ];

    return {
      items: users.map((user) => ({
        ...toPublicUser(user),
        enrollmentsCount: user.enrollmentsCount,
        certificatesCount: user.certificatesCount,
        activeCoursesCount: user.activeCoursesCount,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async get(id: string) {
    const user = await this.users.findOne({
      where: { id, role: 'user' },
      relations: {
        enrollments: { course: true },
        courseProgress: { course: true, lastLesson: true },
        certificates: { course: true },
      },
      order: {
        enrollments: { enrolledAt: 'DESC' },
        courseProgress: { updatedAt: 'DESC' },
        certificates: { issuedAt: 'DESC' },
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
        recipientName: item.recipientName ?? null,
        issuedAt: item.issuedAt.toISOString(),
        course: toCourseSummary(item.course),
      })),
    };
  }

  /** `alreadyActive` tells the controller to answer 200 instead of 201. */
  async grantEnrollment(userId: string, courseId: string) {
    const user = await this.requireLearner(userId);

    const course = await this.courses.findOneBy({ id: courseId });
    if (!course) throw new AppError(404, 'Курс табылган жок');
    if (course.courseType !== 'paid') {
      throw new AppError(400, 'Бекер курс үчүн төлөм талап кылынбайт');
    }

    const now = new Date();
    const existing = await this.enrollments.findOneBy({ userId: user.id, courseId: course.id });

    if (existing?.status === 'active') {
      return { enrollment: toEnrollmentDto(existing, course), alreadyActive: true };
    }

    const enrollment = await this.ds.transaction(async (em) => {
      const record = existing
        ? await em.save(Object.assign(existing, { status: 'active' as const }))
        : await em.save(
            em.create(Enrollment, {
              userId: user.id,
              courseId: course.id,
              status: 'active',
              enrolledAt: now,
              completedAt: null,
            }),
          );

      await em.save(
        em.create(Payment, {
          userId: user.id,
          courseId: course.id,
          amount: course.price,
          currency: course.currency,
          paymentMethod: 'whatsapp',
          transactionId: `whatsapp-${randomUUID()}`,
          status: 'success',
          paidAt: now,
          providerResponse: { source: 'admin_grant' },
        }),
      );

      const existingCourseProgress = await em.findOne(CourseProgress, {
        where: { userId: user.id, courseId: course.id },
        select: { id: true },
      });
      if (!existingCourseProgress) {
        await em.save(
          em.create(CourseProgress, {
            userId: user.id,
            courseId: course.id,
            progressPercent: 0,
            lastLessonId: null,
            isCompleted: false,
            completedAt: null,
          }),
        );
      }

      return record;
    });

    return { enrollment: toEnrollmentDto(enrollment, course), alreadyActive: false };
  }

  async setStatus(id: string, isActive: boolean) {
    const existing = await this.requireLearner(id);
    existing.isActive = isActive;
    const updated = await this.users.save(existing);
    return { user: toPublicUser(updated) };
  }

  async remove(id: string) {
    const existing = await this.requireLearner(id);

    await this.ds.transaction(async (em) => {
      await em.delete(Payment, { userId: existing.id });
      await em.delete(Certificate, { userId: existing.id });
      await em.delete(User, { id: existing.id });
    });

    // Their reviews are cascade-deleted, so the cached public review lists are stale.
    await this.cache.invalidate('reviews:');
    return { ok: true };
  }
}
