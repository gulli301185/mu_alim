import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { AuthUser } from '../common/auth';
import { CacheService } from '../cache/cache.service';
import { CoursesService } from '../courses/courses.service';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL = 120;
const COURSE_NOT_FOUND = 'Курс табылган жок';
const REVIEW_NOT_FOUND = 'Пикир табылган жок';

const reviewStatus = z.enum(['pending', 'approved', 'rejected']);

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(10),
});

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(8000).optional(),
  displayName: z.string().trim().min(1).max(150).optional(),
});

export const adminListQuerySchema = z.object({
  status: reviewStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});

export const adminCreateSchema = z
  .object({
    courseRef: z.string().trim().min(1),
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(8000).optional(),
    videoUrl: z.string().trim().max(500).optional(),
    displayName: z.string().trim().min(1).max(150),
    status: reviewStatus.optional(),
  })
  .refine((data) => Boolean(data.comment?.trim() || data.videoUrl?.trim()), {
    message: 'Текст же видео керек',
  });

export const adminUpdateSchema = z
  .object({
    courseRef: z.string().trim().min(1).optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(8000).optional(),
    videoUrl: z.string().trim().max(500).optional(),
    displayName: z.string().trim().min(1).max(150).optional(),
    status: reviewStatus.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Өзгөртүү керек',
  });

type ListQuery = z.infer<typeof listQuerySchema>;

function toReviewDto(review: {
  id: string;
  rating: number;
  comment: string | null;
  videoUrl?: string | null;
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
    videoUrl: review.videoUrl ?? null,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    authorName: review.displayName?.trim() || fullName,
    courseTitle: review.course?.title,
    courseSlug: review.course?.slug,
  };
}

function hasPublicReviewContent(review: { comment: string | null; videoUrl?: string | null }) {
  return Boolean(review.comment?.trim() || review.videoUrl?.trim());
}

const authorAndCourse = {
  user: { select: { firstName: true, lastName: true } },
  course: { select: { title: true, slug: true } },
} as const;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly courses: CoursesService,
  ) {}

  private invalidate() {
    return this.cache.invalidate('reviews:');
  }

  // ─── Public ────────────────────────────────────────────────────────────────

  listPublic({ page, limit }: ListQuery) {
    return this.cache.wrap(`reviews:list:${page}:${limit}`, CACHE_TTL, async () => {
      const where = {
        status: 'approved' as const,
        OR: [{ comment: { not: null } }, { videoUrl: { not: null } }],
      };

      const [items, total] = await Promise.all([
        this.prisma.review.findMany({
          where,
          include: authorAndCourse,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.review.count({ where }),
      ]);

      return {
        items: items.filter(hasPublicReviewContent).map(toReviewDto),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    });
  }

  async listForCourse(ref: string, query: ListQuery, user: AuthUser | undefined) {
    const course = await this.courses.requireRef(ref);
    const { page, limit } = query;

    // Approved reviews are shared by everyone; only `mine` is per-user and is read live.
    const shared = await this.cache.wrap(`reviews:course:${course.id}:${page}:${limit}`, CACHE_TTL, async () => {
      const where = { courseId: course.id, status: 'approved' as const };
      const [items, total, agg] = await Promise.all([
        this.prisma.review.findMany({
          where,
          include: authorAndCourse,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.review.count({ where }),
        this.prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
      ]);

      return {
        items: items.map(toReviewDto),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        averageRating: agg._avg.rating ? Number(agg._avg.rating.toFixed(1)) : 0,
        ratingsCount: agg._count,
      };
    });

    const mine = user
      ? await this.prisma.review.findFirst({
          where: { userId: user.id, courseId: course.id, isAdminPosted: false },
          include: { user: { select: { firstName: true, lastName: true } } },
        })
      : null;

    return { ...shared, mine: mine ? toReviewDto(mine) : null };
  }

  async create(ref: string, user: AuthUser, data: z.infer<typeof createReviewSchema>) {
    const course = await this.courses.resolveRef(ref);
    if (!course || !course.isPublished) throw new AppError(404, COURSE_NOT_FOUND);

    const review = await this.prisma.review.create({
      data: {
        userId: user.id,
        courseId: course.id,
        rating: data.rating,
        comment: data.comment?.trim() ? data.comment.trim() : null,
        displayName: data.displayName?.trim() || null,
        status: 'approved',
      },
      include: { user: { select: { firstName: true, lastName: true } } },
    });

    await this.invalidate();
    return { review: toReviewDto(review), message: 'Пикир чыгарылды' };
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async adminList({ status, page, limit, q }: z.infer<typeof adminListQuerySchema>) {
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
      this.prisma.review.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          course: { select: { title: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: items.map((item) => ({ ...toReviewDto(item), authorEmail: item.user.email })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async adminCreate(user: AuthUser, data: z.infer<typeof adminCreateSchema>) {
    const course = await this.courses.resolveRef(data.courseRef);
    if (!course) throw new AppError(404, COURSE_NOT_FOUND);

    const review = await this.prisma.review.create({
      data: {
        userId: user.id,
        courseId: course.id,
        rating: data.rating,
        comment: data.comment?.trim() || null,
        videoUrl: data.videoUrl?.trim() || null,
        displayName: data.displayName.trim(),
        isAdminPosted: true,
        status: data.status ?? 'approved',
      },
      include: authorAndCourse,
    });

    await this.invalidate();
    return { review: toReviewDto(review) };
  }

  async adminUpdate(id: string, data: z.infer<typeof adminUpdateSchema>) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, REVIEW_NOT_FOUND);

    let courseId = existing.courseId;
    if (data.courseRef) {
      const course = await this.courses.resolveRef(data.courseRef);
      if (!course) throw new AppError(404, COURSE_NOT_FOUND);
      courseId = course.id;
    }

    const review = await this.prisma.review.update({
      where: { id: existing.id },
      data: {
        courseId,
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
        ...(data.comment !== undefined ? { comment: data.comment.trim() || null } : {}),
        ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl.trim() || null } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      include: authorAndCourse,
    });

    await this.invalidate();
    return { review: toReviewDto(review) };
  }

  async adminDelete(id: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, REVIEW_NOT_FOUND);

    await this.prisma.review.delete({ where: { id: existing.id } });
    await this.invalidate();
    return { ok: true };
  }
}
