import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAdmin } from '../middleware/auth.js';
import { parseYoutubeVideoId } from '../lib/youtube-parse.js';

export const lessonsRouter = Router();

function toDto(lesson: {
  id: string;
  title: string;
  description: string | null;
  youtubeVideoId: string;
  durationSeconds: number | null;
  lessonOrder: number;
  isPublished: boolean;
}) {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    youtubeVideoId: lesson.youtubeVideoId,
    durationSeconds: lesson.durationSeconds,
    lessonOrder: lesson.lessonOrder,
    isPublished: lesson.isPublished,
  };
}

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

const createSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  youtubeUrl: z.string().trim().min(1).max(500),
  durationSeconds: z.number().int().positive().optional(),
  lessonOrder: z.number().int().positive(),
  isPublished: z.boolean().optional().default(false),
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().nullable().optional(),
  youtubeUrl: z.string().trim().min(1).max(500).optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
  lessonOrder: z.number().int().positive().optional(),
  isPublished: z.boolean().optional(),
});

lessonsRouter.get(
  '/courses/:courseId/lessons',
  asyncHandler(async (req, res) => {
    const resolvedCourseId = await resolveCourseId(req.params.courseId);
    if (!resolvedCourseId) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const lessons = await prisma.lesson.findMany({
      where: { courseId: resolvedCourseId, isPublished: true },
      orderBy: { lessonOrder: 'asc' },
    });

    res.json(lessons.map(toDto));
  }),
);

lessonsRouter.post(
  '/courses/:courseId/lessons',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    const resolvedCourseId = await resolveCourseId(req.params.courseId);
    if (!resolvedCourseId) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const videoId = parseYoutubeVideoId(parsed.data.youtubeUrl);
    if (!videoId) {
      res.status(400).json({ error: 'YouTube шилтемеси туура эмес' });
      return;
    }

    const orderTaken = await prisma.lesson.findFirst({
      where: { courseId: resolvedCourseId, lessonOrder: parsed.data.lessonOrder },
      select: { id: true },
    });
    if (orderTaken) {
      res.status(400).json({ error: 'Бул сабак номери бу курс үчүн эле колдонулган' });
      return;
    }

    const lesson = await prisma.lesson.create({
      data: {
        courseId: resolvedCourseId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        youtubeUrl: parsed.data.youtubeUrl,
        youtubeVideoId: videoId,
        durationSeconds: parsed.data.durationSeconds ?? null,
        lessonOrder: parsed.data.lessonOrder,
        isPublished: parsed.data.isPublished ?? false,
      },
    });

    res.status(201).json(toDto(lesson));
  }),
);

lessonsRouter.put(
  '/lessons/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    const existing = await prisma.lesson.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Сабак табылган жок' });
      return;
    }

    const data = parsed.data;
    const updateData: {
      title?: string;
      description?: string | null;
      youtubeUrl?: string;
      youtubeVideoId?: string;
      durationSeconds?: number | null;
      lessonOrder?: number;
      isPublished?: boolean;
    } = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.durationSeconds !== undefined) updateData.durationSeconds = data.durationSeconds;
    if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;

    if (data.youtubeUrl !== undefined) {
      const videoId = parseYoutubeVideoId(data.youtubeUrl);
      if (!videoId) {
        res.status(400).json({ error: 'YouTube шилтемеси туура эмес' });
        return;
      }
      updateData.youtubeUrl = data.youtubeUrl;
      updateData.youtubeVideoId = videoId;
    }

    if (data.lessonOrder !== undefined) {
      const orderTaken = await prisma.lesson.findFirst({
        where: {
          courseId: existing.courseId,
          lessonOrder: data.lessonOrder,
          NOT: { id: existing.id },
        },
        select: { id: true },
      });
      if (orderTaken) {
        res.status(400).json({ error: 'Бул сабак номери бу курс үчүн эле колдонулган' });
        return;
      }
      updateData.lessonOrder = data.lessonOrder;
    }

    const lesson = await prisma.lesson.update({
      where: { id: existing.id },
      data: updateData,
    });

    res.json(toDto(lesson));
  }),
);

lessonsRouter.delete(
  '/lessons/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.lesson.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) {
      res.status(404).json({ error: 'Сабак табылган жок' });
      return;
    }

    await prisma.lesson.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);
