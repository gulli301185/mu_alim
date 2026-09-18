import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { userCanWatchPaidCourse } from '../lib/course-access.js';

export const progressRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveCourseId(courseId: string) {
  if (UUID_RE.test(courseId)) {
    const byId = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (byId) return byId.id;
  }
  const bySlug = await prisma.course.findUnique({ where: { slug: courseId }, select: { id: true } });
  return bySlug?.id ?? null;
}

progressRouter.get(
  '/courses/:courseId/progress',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'user') {
      res.status(403).json({ error: 'Колдонуучу аккаунту керек' });
      return;
    }

    const courseId = await resolveCourseId(req.params.courseId);
    if (!courseId) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const canWatch = await userCanWatchPaidCourse(req.user, courseId);
    if (!canWatch) {
      res.status(403).json({ error: 'Курс ачыла элек' });
      return;
    }

    const [enrollment, courseProgress, lessonRows] = await Promise.all([
      prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: req.user!.id, courseId } },
        select: { enrolledAt: true, completedAt: true, status: true },
      }),
      prisma.courseProgress.findUnique({
        where: { userId_courseId: { userId: req.user!.id, courseId } },
        select: { isCompleted: true, progressPercent: true },
      }),
      prisma.lessonProgress.findMany({
        where: {
          userId: req.user!.id,
          isLessonCompleted: true,
          lesson: { courseId, isPublished: true },
        },
        select: { lessonId: true },
      }),
    ]);

    const completedLessonIds = lessonRows.map((row) => row.lessonId);

    res.json({
      completedLessonIds,
      isCompleted: Boolean(courseProgress?.isCompleted || enrollment?.completedAt),
      enrolledAt: enrollment?.enrolledAt?.toISOString() ?? null,
    });
  }),
);

progressRouter.post(
  '/courses/:courseId/progress/lessons/:lessonId/complete',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'user') {
      res.status(403).json({ error: 'Колдонуучу аккаунту керек' });
      return;
    }

    const courseId = await resolveCourseId(req.params.courseId);
    if (!courseId) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const canWatch = await userCanWatchPaidCourse(req.user, courseId);
    if (!canWatch) {
      res.status(403).json({ error: 'Курс ачыла элек' });
      return;
    }

    const lesson = await prisma.lesson.findFirst({
      where: { id: req.params.lessonId, courseId, isPublished: true },
      select: { id: true, lessonOrder: true },
    });
    if (!lesson) {
      res.status(404).json({ error: 'Сабак табылган жок' });
      return;
    }

    if (lesson.lessonOrder > 1) {
      const previous = await prisma.lesson.findFirst({
        where: { courseId, isPublished: true, lessonOrder: lesson.lessonOrder - 1 },
        select: { id: true },
      });
      if (previous) {
        const prevDone = await prisma.lessonProgress.findUnique({
          where: { userId_lessonId: { userId: req.user!.id, lessonId: previous.id } },
          select: { isLessonCompleted: true },
        });
        if (!prevDone?.isLessonCompleted) {
          res.status(400).json({ error: 'Мурунку сабакты бүтүрүңүз' });
          return;
        }
      }
    }

    const now = new Date();
    const [lessons, completedCount] = await prisma.$transaction(async (tx) => {
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
        create: {
          userId: req.user!.id,
          lessonId: lesson.id,
          isVideoCompleted: true,
          isLessonCompleted: true,
          completedAt: now,
        },
        update: {
          isVideoCompleted: true,
          isLessonCompleted: true,
          completedAt: now,
        },
      });

      const published = await tx.lesson.findMany({
        where: { courseId, isPublished: true },
        select: { id: true },
        orderBy: { lessonOrder: 'asc' },
      });
      const done = await tx.lessonProgress.count({
        where: {
          userId: req.user!.id,
          isLessonCompleted: true,
          lessonId: { in: published.map((item) => item.id) },
        },
      });
      const percent = published.length ? Math.round((done / published.length) * 100) : 0;
      const allDone = published.length > 0 && done >= published.length;

      await tx.courseProgress.upsert({
        where: { userId_courseId: { userId: req.user!.id, courseId } },
        create: {
          userId: req.user!.id,
          courseId,
          lastLessonId: lesson.id,
          progressPercent: percent,
          isCompleted: allDone,
          completedAt: allDone ? now : null,
        },
        update: {
          lastLessonId: lesson.id,
          progressPercent: percent,
          isCompleted: allDone,
          completedAt: allDone ? now : null,
        },
      });

      const completedRows = await tx.lessonProgress.findMany({
        where: {
          userId: req.user!.id,
          isLessonCompleted: true,
          lessonId: { in: published.map((item) => item.id) },
        },
        select: { lessonId: true },
      });

      return [published, completedRows] as const;
    });

    res.json({
      completedLessonIds: completedCount.map((row) => row.lessonId),
      totalLessons: lessons.length,
    });
  }),
);

progressRouter.post(
  '/courses/:courseId/progress/sync',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user!.role !== 'user') {
      res.status(403).json({ error: 'Колдонуучу аккаунту керек' });
      return;
    }

    const courseId = await resolveCourseId(req.params.courseId);
    if (!courseId) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const canWatch = await userCanWatchPaidCourse(req.user, courseId);
    if (!canWatch) {
      res.status(403).json({ error: 'Курс ачыла элек' });
      return;
    }

    const requested = Array.isArray(req.body?.completedLessonIds)
      ? (req.body.completedLessonIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];

    const published = await prisma.lesson.findMany({
      where: { courseId, isPublished: true },
      select: { id: true, lessonOrder: true },
      orderBy: { lessonOrder: 'asc' },
    });

    const byId = new Set(published.map((lesson) => lesson.id));
    const matched = requested.filter((id) => byId.has(id));
    const maxOrder =
      matched.length > 0
        ? Math.max(
            0,
            ...matched.map((id) => published.find((lesson) => lesson.id === id)?.lessonOrder ?? 0),
          )
        : requested.length > 0
          ? Math.min(requested.length, published.length)
          : 0;

    const toComplete = published.filter((lesson) => lesson.lessonOrder <= maxOrder);
    const now = new Date();

    const completedRows = await prisma.$transaction(async (tx) => {
      for (const lesson of toComplete) {
        await tx.lessonProgress.upsert({
          where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
          create: {
            userId: req.user!.id,
            lessonId: lesson.id,
            isVideoCompleted: true,
            isLessonCompleted: true,
            completedAt: now,
          },
          update: {
            isVideoCompleted: true,
            isLessonCompleted: true,
            completedAt: now,
          },
        });
      }

      const done = toComplete.length;
      const percent = published.length ? Math.round((done / published.length) * 100) : 0;
      const allDone = published.length > 0 && done >= published.length;
      const lastLessonId = toComplete.at(-1)?.id ?? null;

      await tx.courseProgress.upsert({
        where: { userId_courseId: { userId: req.user!.id, courseId } },
        create: {
          userId: req.user!.id,
          courseId,
          lastLessonId,
          progressPercent: percent,
          isCompleted: allDone,
          completedAt: allDone ? now : null,
        },
        update: {
          lastLessonId,
          progressPercent: percent,
          isCompleted: allDone,
          completedAt: allDone ? now : undefined,
        },
      });

      if (allDone) {
        await tx.enrollment.updateMany({
          where: { userId: req.user!.id, courseId, status: 'active' },
          data: { completedAt: now },
        });
      }

      return tx.lessonProgress.findMany({
        where: {
          userId: req.user!.id,
          isLessonCompleted: true,
          lessonId: { in: published.map((item) => item.id) },
        },
        select: { lessonId: true },
      });
    });

    res.json({
      completedLessonIds: completedRows.map((row) => row.lessonId),
    });
  }),
);
