import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { optionalAuth, requireAdmin, requireAuth } from '../middleware/auth.js';

export const reviewsRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function resolveCourseRef(ref: string) {
  if (UUID_RE.test(ref)) {
    const byId = await prisma.course.findUnique({ where: { id: ref } });
    if (byId) return byId;
  }
  return prisma.course.findUnique({ where: { slug: ref } });
}

function toReviewDto(review: {
  id: string;
  rating: number;
  comment: string | null;
  displayName?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
  user: { firstName: string; lastName: string };
  course?: { title: string; slug: string };
}) {
  const fullName = `${review.user.firstName} ${review.user.lastName}`.trim();
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    authorName: review.displayName?.trim() || fullName,
    courseTitle: review.course?.title,
    courseSlug: review.course?.slug,
  };
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(10),
});

const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(8000).optional(),
  displayName: z.string().trim().min(1).max(150).optional(),
});

const adminListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});

const adminCreateSchema = z.object({
  courseRef: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(8000),
  displayName: z.string().trim().min(1).max(150),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

const moderateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

reviewsRouter.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Сурам туура эмес' });
      return;
    }
    const { page, limit } = parsed.data;
    const skip = (page - 1) * limit;
    const where = {
      status: 'approved' as const,
      comment: { not: null },
    };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true } },
          course: { select: { title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    const withText = items.filter((item) => item.comment?.trim());

    res.json({
      items: withText.map(toReviewDto),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

reviewsRouter.get(
  '/courses/:ref/reviews',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const course = await resolveCourseRef(req.params.ref);
    if (!course) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Сурам туура эмес' });
      return;
    }
    const { page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const [items, total, agg, mine] = await Promise.all([
      prisma.review.findMany({
        where: { courseId: course.id, status: 'approved' },
        include: {
          user: { select: { firstName: true, lastName: true } },
          course: { select: { title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where: { courseId: course.id, status: 'approved' } }),
      prisma.review.aggregate({
        where: { courseId: course.id, status: 'approved' },
        _avg: { rating: true },
        _count: true,
      }),
      req.user
        ? prisma.review.findFirst({
            where: { userId: req.user.id, courseId: course.id, isAdminPosted: false },
            include: { user: { select: { firstName: true, lastName: true } } },
          })
        : Promise.resolve(null),
    ]);

    res.json({
      items: items.map(toReviewDto),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0,
      ratingsCount: agg._count,
      mine: mine ? toReviewDto(mine) : null,
    });
  }),
);

reviewsRouter.post(
  '/courses/:ref/reviews',
  requireAuth,
  asyncHandler(async (req, res) => {
    const course = await resolveCourseRef(req.params.ref);
    if (!course || !course.isPublished) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Рейтинг 1–5 болушу керек' });
      return;
    }

    const comment = parsed.data.comment?.trim() ? parsed.data.comment.trim() : null;
    const displayName = parsed.data.displayName?.trim() || null;
    const review = await prisma.review.create({
      data: {
        userId: req.user!.id,
        courseId: course.id,
        rating: parsed.data.rating,
        comment,
        displayName,
        status: 'approved',
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    res.status(201).json({
      review: toReviewDto(review),
      message: 'Пикир чыгарылды',
    });
  }),
);

reviewsRouter.get(
  '/admin/reviews',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = adminListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Сурам туура эмес' });
      return;
    }
    const { status, page, limit, q } = parsed.data;
    const skip = (page - 1) * limit;
    const search = q?.trim();

    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { comment: { contains: search, mode: 'insensitive' as const } },
              { course: { title: { contains: search, mode: 'insensitive' as const } } },
              { user: { firstName: { contains: search, mode: 'insensitive' as const } } },
              { user: { lastName: { contains: search, mode: 'insensitive' as const } } },
              { user: { email: { contains: search, mode: 'insensitive' as const } } },
              { displayName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          course: { select: { title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.review.count({ where }),
    ]);

    res.json({
      items: items.map((item) => ({
        ...toReviewDto(item),
        authorEmail: item.user.email,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

reviewsRouter.post(
  '/admin/reviews',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = adminCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Курс, отзыв жазган адамдын аты жана текст керек' });
      return;
    }

    const course = await resolveCourseRef(parsed.data.courseRef);
    if (!course) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const review = await prisma.review.create({
      data: {
        userId: req.user!.id,
        courseId: course.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
        displayName: parsed.data.displayName.trim(),
        isAdminPosted: true,
        status: parsed.data.status ?? 'approved',
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        course: { select: { title: true, slug: true } },
      },
    });

    res.status(201).json({ review: toReviewDto(review) });
  }),
);

reviewsRouter.patch(
  '/admin/reviews/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = moderateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Статус туура эмес' });
      return;
    }

    const existing = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Пикир табылган жок' });
      return;
    }

    const review = await prisma.review.update({
      where: { id: existing.id },
      data: { status: parsed.data.status },
      include: {
        user: { select: { firstName: true, lastName: true } },
        course: { select: { title: true, slug: true } },
      },
    });

    res.json({ review: toReviewDto(review) });
  }),
);

reviewsRouter.delete(
  '/admin/reviews/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Пикир табылган жок' });
      return;
    }

    await prisma.review.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  }),
);
