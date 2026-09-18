import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAdmin } from '../middleware/auth.js';

export const adminUsersRouter = Router();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

const statusSchema = z.object({
  isActive: z.boolean(),
});

const grantEnrollmentSchema = z.object({
  courseId: z.string().uuid(),
});

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

adminUsersRouter.get(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Жараксыз параметрлер' });
      return;
    }

    const { page, limit, search } = parsed.data;
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
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: {
            select: {
              enrollments: true,
              certificates: true,
              courseProgress: true,
            },
          },
        },
      }),
    ]);

    res.json({
      items: users.map((user) => ({
        ...toPublicUser(user),
        enrollmentsCount: user._count.enrollments,
        certificatesCount: user._count.certificates,
        activeCoursesCount: user._count.courseProgress,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

adminUsersRouter.get(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'user' },
      include: {
        enrollments: {
          orderBy: { enrolledAt: 'desc' },
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                courseType: true,
                price: true,
                currency: true,
              },
            },
          },
        },
        courseProgress: {
          orderBy: { updatedAt: 'desc' },
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                courseType: true,
                price: true,
                currency: true,
              },
            },
            lastLesson: {
              select: {
                id: true,
                title: true,
                lessonOrder: true,
              },
            },
          },
        },
        certificates: {
          orderBy: { issuedAt: 'desc' },
          include: {
            course: {
              select: {
                id: true,
                title: true,
                slug: true,
                courseType: true,
                price: true,
                currency: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Колдонуучу табылган жок' });
      return;
    }

    res.json({
      user: toPublicUser(user),
      enrollments: user.enrollments.map((item) => ({
        id: item.id,
        status: item.status,
        enrolledAt: item.enrolledAt.toISOString(),
        completedAt: item.completedAt?.toISOString() ?? null,
        course: toCourseSummary(item.course),
      })),
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
    });
  }),
);

adminUsersRouter.post(
  '/:id/enrollments',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = grantEnrollmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Курс тандоо керек' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'user' },
    });
    if (!user) {
      res.status(404).json({ error: 'Колдонуучу табылган жок' });
      return;
    }

    const course = await prisma.course.findUnique({
      where: { id: parsed.data.courseId },
    });
    if (!course) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }
    if (course.courseType !== 'paid') {
      res.status(400).json({ error: 'Бекер курс үчүн төлөм талап кылынбайт' });
      return;
    }

    const now = new Date();
    const existing = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId: user.id, courseId: course.id },
      },
    });

    if (existing?.status === 'active') {
      res.json({
        enrollment: {
          id: existing.id,
          status: existing.status,
          enrolledAt: existing.enrolledAt.toISOString(),
          completedAt: existing.completedAt?.toISOString() ?? null,
          course: toCourseSummary(course),
        },
        alreadyActive: true,
      });
      return;
    }

    const enrollment = await prisma.$transaction(async (tx) => {
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
            data: {
              userId: user.id,
              courseId: course.id,
              status: 'active',
              enrolledAt: now,
            },
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
          data: {
            userId: user.id,
            courseId: course.id,
            progressPercent: 0,
            isCompleted: false,
          },
        });
      }

      return record;
    });

    res.status(201).json({
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt.toISOString(),
        completedAt: enrollment.completedAt?.toISOString() ?? null,
        course: toCourseSummary(course),
      },
      alreadyActive: false,
    });
  }),
);

adminUsersRouter.patch(
  '/:id/status',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Жараксыз маалымат' });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'user' },
    });

    if (!existing) {
      res.status(404).json({ error: 'Колдонуучу табылган жок' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { isActive: parsed.data.isActive },
    });

    res.json({ user: toPublicUser(updated) });
  }),
);

adminUsersRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, role: 'user' },
    });

    if (!existing) {
      res.status(404).json({ error: 'Колдонуучу табылган жок' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { userId: existing.id } });
      await tx.certificate.deleteMany({ where: { userId: existing.id } });
      await tx.user.delete({ where: { id: existing.id } });
    });

    res.json({ ok: true });
  }),
);
