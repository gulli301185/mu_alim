import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { AuthUser } from '../common/auth';
import { CacheService } from '../cache/cache.service';
import { CoursesService } from '../courses/courses.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { anyContains } from '../database/sql';
import { Review } from '../database/entities';

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

const authorAndCourse = { user: true, course: true } as const;

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    private readonly cache: CacheService,
    private readonly courses: CoursesService,
  ) {}

  private invalidate() {
    return this.cache.invalidate('reviews:');
  }

  // ─── Public ────────────────────────────────────────────────────────────────

  listPublic({ page, limit }: ListQuery) {
    return this.cache.wrap(`reviews:list:${page}:${limit}`, CACHE_TTL, async () => {
      const where = [
        { status: 'approved' as const, comment: Not(IsNull()) },
        { status: 'approved' as const, videoUrl: Not(IsNull()) },
      ];

      const [items, total] = await Promise.all([
        this.reviewRepo.find({
          where,
          relations: authorAndCourse,
          order: { createdAt: 'DESC' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.reviewRepo.count({ where }),
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
        this.reviewRepo.find({
          where,
          relations: authorAndCourse,
          order: { createdAt: 'DESC' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.reviewRepo.countBy(where),
        this.reviewRepo
          .createQueryBuilder('r')
          .select('AVG(r.rating)', 'avg')
          .addSelect('COUNT(*)', 'count')
          .where('r.courseId = :courseId', { courseId: course.id })
          .andWhere("r.status = 'approved'")
          .getRawOne<{ avg: string | null; count: string }>(),
      ]);

      return {
        items: items.map(toReviewDto),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        averageRating: agg?.avg ? Number(Number(agg.avg).toFixed(1)) : 0,
        ratingsCount: Number(agg?.count ?? 0),
      };
    });

    const mine = user
      ? await this.reviewRepo.findOne({
          where: { userId: user.id, courseId: course.id, isAdminPosted: false },
          relations: { user: true },
        })
      : null;

    return { ...shared, mine: mine ? toReviewDto(mine) : null };
  }

  async create(ref: string, user: AuthUser, data: z.infer<typeof createReviewSchema>) {
    const course = await this.courses.resolveRef(ref);
    if (!course || !course.isPublished) throw new AppError(404, COURSE_NOT_FOUND);

    const saved = await this.reviewRepo.save(
      this.reviewRepo.create({
        userId: user.id,
        courseId: course.id,
        rating: data.rating,
        comment: data.comment?.trim() ? data.comment.trim() : null,
        videoUrl: null,
        displayName: data.displayName?.trim() || null,
        isAdminPosted: false,
        status: 'approved',
      }),
    );
    const review = await this.reviewRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { user: true },
    });

    await this.invalidate();
    return { review: toReviewDto(review), message: 'Пикир чыгарылды' };
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async adminList({ status, page, limit, q }: z.infer<typeof adminListQuerySchema>) {
    const search = q?.trim();

    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.user', 'u')
      .innerJoinAndSelect('r.course', 'c')
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (status) qb.andWhere('r.status = :status', { status });
    if (search) {
      qb.andWhere(
        anyContains(
          ['r.comment', 'c.title', 'u.firstName', 'u.lastName', 'u.email', 'r.displayName'],
          'search',
          search,
        ),
      );
    }

    const [items, total] = await qb.getManyAndCount();

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

    const saved = await this.reviewRepo.save(
      this.reviewRepo.create({
        userId: user.id,
        courseId: course.id,
        rating: data.rating,
        comment: data.comment?.trim() || null,
        videoUrl: data.videoUrl?.trim() || null,
        displayName: data.displayName.trim(),
        isAdminPosted: true,
        status: data.status ?? 'approved',
      }),
    );
    const review = await this.reviewRepo.findOneOrFail({
      where: { id: saved.id },
      relations: authorAndCourse,
    });

    await this.invalidate();
    return { review: toReviewDto(review) };
  }

  async adminUpdate(id: string, data: z.infer<typeof adminUpdateSchema>) {
    const existing = await this.reviewRepo.findOneBy({ id });
    if (!existing) throw new AppError(404, REVIEW_NOT_FOUND);

    let courseId = existing.courseId;
    if (data.courseRef) {
      const course = await this.courses.resolveRef(data.courseRef);
      if (!course) throw new AppError(404, COURSE_NOT_FOUND);
      courseId = course.id;
    }

    existing.courseId = courseId;
    if (data.rating !== undefined) existing.rating = data.rating;
    if (data.comment !== undefined) existing.comment = data.comment.trim() || null;
    if (data.videoUrl !== undefined) existing.videoUrl = data.videoUrl.trim() || null;
    if (data.displayName !== undefined) existing.displayName = data.displayName;
    if (data.status !== undefined) existing.status = data.status;
    await this.reviewRepo.save(existing);
    const review = await this.reviewRepo.findOneOrFail({
      where: { id: existing.id },
      relations: authorAndCourse,
    });

    await this.invalidate();
    return { review: toReviewDto(review) };
  }

  async adminDelete(id: string) {
    const existing = await this.reviewRepo.findOneBy({ id });
    if (!existing) throw new AppError(404, REVIEW_NOT_FOUND);

    await this.reviewRepo.delete({ id: existing.id });
    await this.invalidate();
    return { ok: true };
  }
}
