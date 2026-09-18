import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../middleware/auth.js';

export const enrollmentsRouter = Router();

enrollmentsRouter.get(
  '/me/enrollments',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'user') {
      res.status(403).json({ error: 'Колдонуучу аккаунту керек' });
      return;
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user!.id, status: 'active' },
      orderBy: { enrolledAt: 'desc' },
      include: {
        course: {
          select: { id: true, slug: true, title: true, courseType: true },
        },
      },
    });

    res.json({
      items: enrollments.map((item) => ({
        id: item.id,
        status: item.status,
        enrolledAt: item.enrolledAt.toISOString(),
        courseId: item.course.id,
        courseSlug: item.course.slug,
        courseTitle: item.course.title,
        courseType: item.course.courseType,
      })),
    });
  }),
);
