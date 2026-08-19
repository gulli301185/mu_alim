import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAdmin } from '../middleware/auth.js';

export const coursesRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveCourseRef(ref: string) {
  if (UUID_RE.test(ref)) {
    const byId = await prisma.course.findUnique({ where: { id: ref } });
    if (byId) return byId;
  }
  return prisma.course.findUnique({ where: { slug: ref } });
}

function toPublicCourse(course: {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  coverImage: string | null;
  courseType: 'free' | 'paid';
  price: Prisma.Decimal;
  currency: string;
  level: string | null;
  isPopular: boolean;
  isPublished: boolean;
  _count?: { lessons: number };
  lessons?: { youtubeVideoId: string; durationSeconds: number | null }[];
}) {
  const firstLesson = course.lessons?.[0];
  return {
    id: course.slug,
    recordId: course.id,
    slug: course.slug,
    title: course.title,
    shortDescription: course.shortDescription,
    description: course.description,
    coverImage: course.coverImage,
    courseType: course.courseType,
    price: Number(course.price),
    currency: course.currency,
    priceLabel:
      course.courseType === 'free'
        ? 'Бекер'
        : `${Number(course.price).toLocaleString('ru-RU')} ${course.currency}`,
    level: course.level,
    isPopular: course.isPopular,
    lessonCount: course._count?.lessons ?? course.lessons?.length ?? 0,
    introVideoId: firstLesson?.youtubeVideoId ?? null,
    introDurationSeconds: firstLesson?.durationSeconds ?? null,
  };
}

const listQuerySchema = z.object({
  type: z.enum(['free', 'paid']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const createCourseSchema = z.object({
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(280).optional(),
  description: z.string().trim().min(1),
  shortDescription: z.string().trim().max(500).optional(),
  courseType: z.enum(['free', 'paid']),
  price: z.number().nonnegative().optional(),
  currency: z.string().trim().max(10).optional(),
  level: z.string().trim().max(30).optional(),
  isPublished: z.boolean().optional(),
  isPopular: z.boolean().optional(),
});

const updateCourseSchema = createCourseSchema.partial();

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u0400-\u04FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 280);
}

async function defaultCategoryId(courseType: 'free' | 'paid') {
  const slug = courseType === 'free' ? 'free-courses' : 'paid-courses';
  const category = await prisma.category.findUnique({ where: { slug } });
  if (category) return category.id;
  const created = await prisma.category.create({
    data: {
      slug,
      name: courseType === 'free' ? 'Бекер курстар' : 'Акы төлөнүүчү курстар',
      isActive: true,
    },
  });
  return created.id;
}

coursesRouter.get(
  '/free-lessons',
  asyncHandler(async (_req, res) => {
    const lessons = await prisma.lesson.findMany({
      where: {
        isPublished: true,
        course: { courseType: 'free', isPublished: true },
      },
      orderBy: [{ course: { title: 'asc' } }, { lessonOrder: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        youtubeUrl: true,
        youtubeVideoId: true,
        durationSeconds: true,
        lessonOrder: true,
        course: {
          select: { id: true, slug: true, title: true },
        },
      },
    });

    res.json({
      items: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        youtubeUrl: lesson.youtubeUrl,
        youtubeVideoId: lesson.youtubeVideoId,
        durationSeconds: lesson.durationSeconds,
        lessonOrder: lesson.lessonOrder,
        courseSlug: lesson.course.slug,
        courseTitle: lesson.course.title,
      })),
      total: lessons.length,
    });
  }),
);

coursesRouter.get(
  '/courses',
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Жараксыз параметрлер' });
      return;
    }

    const { type, page, limit } = parsed.data;
    const where: Prisma.CourseWhereInput = {
      isPublished: true,
      ...(type ? { courseType: type } : {}),
    };

    const [total, courses] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        orderBy: [{ isPopular: 'desc' }, { title: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { lessons: { where: { isPublished: true } } } },
          lessons: {
            where: { isPublished: true },
            orderBy: { lessonOrder: 'asc' },
            take: 1,
            select: { youtubeVideoId: true, durationSeconds: true },
          },
        },
      }),
    ]);

    res.json({
      items: courses.map(toPublicCourse),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

coursesRouter.get(
  '/courses/:courseRef',
  asyncHandler(async (req, res) => {
    const course = await resolveCourseRef(req.params.courseRef);
    if (!course || !course.isPublished) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const full = await prisma.course.findUnique({
      where: { id: course.id },
      include: {
        _count: { select: { lessons: { where: { isPublished: true } } } },
        lessons: {
          where: { isPublished: true },
          orderBy: { lessonOrder: 'asc' },
          take: 1,
          select: { youtubeVideoId: true, durationSeconds: true },
        },
      },
    });

    if (!full) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    res.json({ course: toPublicCourse(full) });
  }),
);

coursesRouter.get(
  '/admin/courses',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Жараксыз параметрлер' });
      return;
    }

    const { type, page, limit } = parsed.data;
    const where: Prisma.CourseWhereInput = type ? { courseType: type } : {};

    const [total, courses] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        orderBy: [{ courseType: 'asc' }, { title: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { lessons: true, enrollments: true } },
        },
      }),
    ]);

    res.json({
      items: courses.map((course) => ({
        ...toPublicCourse({ ...course, lessons: [] }),
        isPublished: course.isPublished,
        enrollmentsCount: course._count.enrollments,
        lessonsCount: course._count.lessons,
        createdAt: course.createdAt.toISOString(),
        updatedAt: course.updatedAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

coursesRouter.post(
  '/admin/courses',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = createCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    const data = parsed.data;
    const slug = data.slug?.trim() || slugify(data.title);
    const exists = await prisma.course.findUnique({ where: { slug } });
    if (exists) {
      res.status(409).json({ error: 'Бул slug эле бар' });
      return;
    }

    const courseType = data.courseType;
    const course = await prisma.course.create({
      data: {
        categoryId: await defaultCategoryId(courseType),
        title: data.title,
        slug,
        description: data.description,
        shortDescription: data.shortDescription ?? null,
        courseType,
        price: courseType === 'free' ? 0 : (data.price ?? 0),
        currency: data.currency ?? 'KGS',
        level: data.level ?? null,
        isPublished: data.isPublished ?? false,
        isPopular: data.isPopular ?? false,
        publishedAt: data.isPublished ? new Date() : null,
      },
      include: { _count: { select: { lessons: true } } },
    });

    res.status(201).json({
      course: {
        ...toPublicCourse({ ...course, lessons: [] }),
        isPublished: course.isPublished,
        lessonsCount: course._count.lessons,
      },
    });
  }),
);

coursesRouter.get(
  '/admin/courses/:courseRef',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const course = await resolveCourseRef(req.params.courseRef);
    if (!course) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const full = await prisma.course.findUnique({
      where: { id: course.id },
      include: {
        _count: { select: { lessons: true, enrollments: true } },
        lessons: {
          orderBy: { lessonOrder: 'asc' },
          take: 1,
          select: { youtubeVideoId: true, durationSeconds: true },
        },
      },
    });

    if (!full) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    res.json({
      course: {
        ...toPublicCourse(full),
        isPublished: full.isPublished,
        lessonsCount: full._count.lessons,
        enrollmentsCount: full._count.enrollments,
      },
    });
  }),
);

coursesRouter.put(
  '/admin/courses/:courseRef',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = updateCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    const existing = await resolveCourseRef(req.params.courseRef);
    if (!existing) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const data = parsed.data;
    if (data.slug && data.slug !== existing.slug) {
      const slugTaken = await prisma.course.findUnique({ where: { slug: data.slug } });
      if (slugTaken) {
        res.status(409).json({ error: 'Бул slug эле бар' });
        return;
      }
    }

    const nextType = data.courseType ?? existing.courseType;
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.shortDescription !== undefined ? { shortDescription: data.shortDescription } : {}),
        ...(data.courseType !== undefined ? { courseType: data.courseType } : {}),
        ...(data.price !== undefined ? { price: nextType === 'free' ? 0 : data.price } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.level !== undefined ? { level: data.level } : {}),
        ...(data.isPopular !== undefined ? { isPopular: data.isPopular } : {}),
        ...(data.isPublished !== undefined
          ? { isPublished: data.isPublished, publishedAt: data.isPublished ? new Date() : null }
          : {}),
      },
      include: {
        _count: { select: { lessons: true } },
        lessons: {
          orderBy: { lessonOrder: 'asc' },
          take: 1,
          select: { youtubeVideoId: true, durationSeconds: true },
        },
      },
    });

    res.json({
      course: {
        ...toPublicCourse(course),
        isPublished: course.isPublished,
        lessonsCount: course._count.lessons,
      },
    });
  }),
);

coursesRouter.delete(
  '/admin/courses/:courseRef',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await resolveCourseRef(req.params.courseRef);
    if (!existing) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    await prisma.course.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);

coursesRouter.get(
  '/admin/courses/:courseRef/lessons',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const course = await resolveCourseRef(req.params.courseRef);
    if (!course) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const lessons = await prisma.lesson.findMany({
      where: { courseId: course.id },
      orderBy: { lessonOrder: 'asc' },
    });

    res.json(
      lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        youtubeUrl: lesson.youtubeUrl,
        youtubeVideoId: lesson.youtubeVideoId,
        durationSeconds: lesson.durationSeconds,
        lessonOrder: lesson.lessonOrder,
        isPublished: lesson.isPublished,
      })),
    );
  }),
);
