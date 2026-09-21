import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { AuthUser } from '../common/auth';
import { UUID_RE } from '../common/uuid';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { fetchYoutubePlaylistVideos } from '../lib/youtube-playlist';

const CACHE_TTL = 300;
const NOT_FOUND = 'Курс табылган жок';

export const listQuerySchema = z.object({
  type: z.enum(['free', 'paid']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createCourseSchema = z.object({
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

export const updateCourseSchema = createCourseSchema.partial();

export const importPlaylistSchema = z.object({
  playlistUrl: z.string().trim().min(1).max(500),
  replace: z.boolean().optional(),
});

type ListQuery = z.infer<typeof listQuerySchema>;

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
    introVideoId: course.courseType === 'free' ? (firstLesson?.youtubeVideoId ?? null) : null,
    introDurationSeconds: firstLesson?.durationSeconds ?? null,
  };
}

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 280);
}

const publishedIntro = {
  _count: { select: { lessons: { where: { isPublished: true } } } },
  lessons: {
    where: { isPublished: true },
    orderBy: { lessonOrder: 'asc' },
    take: 1,
    select: { youtubeVideoId: true, durationSeconds: true },
  },
} satisfies Prisma.CourseInclude;

const firstLessonIntro = {
  orderBy: { lessonOrder: 'asc' },
  take: 1,
  select: { youtubeVideoId: true, durationSeconds: true },
} satisfies Prisma.Course$lessonsArgs;

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Everything derived from courses/lessons (and course titles embedded in reviews) is dropped together. */
  invalidate() {
    return this.cache.invalidate('courses:', 'reviews:');
  }

  async resolveRef(ref: string) {
    if (UUID_RE.test(ref)) {
      const byId = await this.prisma.course.findUnique({ where: { id: ref } });
      if (byId) return byId;
    }
    return this.prisma.course.findUnique({ where: { slug: ref } });
  }

  async resolveId(ref: string) {
    if (UUID_RE.test(ref)) {
      const byId = await this.prisma.course.findUnique({ where: { id: ref }, select: { id: true } });
      if (byId) return byId.id;
    }
    const bySlug = await this.prisma.course.findUnique({ where: { slug: ref }, select: { id: true } });
    return bySlug?.id ?? null;
  }

  async requireRef(ref: string) {
    const course = await this.resolveRef(ref);
    if (!course) throw new AppError(404, NOT_FOUND);
    return course;
  }

  async userCanWatchPaidCourse(user: AuthUser | undefined, courseId: string): Promise<boolean> {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
      select: { status: true },
    });

    return enrollment?.status === 'active';
  }

  // ─── Public ────────────────────────────────────────────────────────────────

  freeLessons() {
    return this.cache.wrap('courses:free-lessons', CACHE_TTL, async () => {
      const lessons = await this.prisma.lesson.findMany({
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
          course: { select: { id: true, slug: true, title: true } },
        },
      });

      return {
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
      };
    });
  }

  listPublic({ type, page, limit }: ListQuery) {
    return this.cache.wrap(`courses:list:${type ?? 'all'}:${page}:${limit}`, CACHE_TTL, async () => {
      const where: Prisma.CourseWhereInput = {
        isPublished: true,
        ...(type ? { courseType: type } : {}),
      };

      const [total, courses] = await Promise.all([
        this.prisma.course.count({ where }),
        this.prisma.course.findMany({
          where,
          orderBy: [{ isPopular: 'desc' }, { title: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: publishedIntro,
        }),
      ]);

      return {
        items: courses.map(toPublicCourse),
        total,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    });
  }

  async getPublic(ref: string) {
    const result = await this.cache.wrap(`courses:detail:${ref}`, CACHE_TTL, async () => {
      const course = await this.resolveRef(ref);
      if (!course || !course.isPublished) return null;

      const full = await this.prisma.course.findUnique({
        where: { id: course.id },
        include: publishedIntro,
      });
      return full ? { course: toPublicCourse(full) } : null;
    });

    if (!result) throw new AppError(404, NOT_FOUND);
    return result;
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async adminList({ type, page, limit }: ListQuery) {
    const where: Prisma.CourseWhereInput = type ? { courseType: type } : {};

    const [total, courses] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        orderBy: [{ courseType: 'asc' }, { title: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { lessons: true, enrollments: true } } },
      }),
    ]);

    return {
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
    };
  }

  private async defaultCategoryId(courseType: 'free' | 'paid') {
    const slug = courseType === 'free' ? 'free-courses' : 'paid-courses';
    const category = await this.prisma.category.findUnique({ where: { slug } });
    if (category) return category.id;
    const created = await this.prisma.category.create({
      data: {
        slug,
        name: courseType === 'free' ? 'Бекер курстар' : 'Акы төлөнүүчү курстар',
        isActive: true,
      },
    });
    return created.id;
  }

  async adminCreate(data: z.infer<typeof createCourseSchema>) {
    const slug = data.slug?.trim() || slugify(data.title);
    const exists = await this.prisma.course.findUnique({ where: { slug } });
    if (exists) throw new AppError(409, 'Бул slug эле бар');

    const courseType = data.courseType;
    const course = await this.prisma.course.create({
      data: {
        categoryId: await this.defaultCategoryId(courseType),
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

    await this.invalidate();
    return {
      course: {
        ...toPublicCourse({ ...course, lessons: [] }),
        isPublished: course.isPublished,
        lessonsCount: course._count.lessons,
      },
    };
  }

  async adminGet(ref: string) {
    const course = await this.requireRef(ref);
    const full = await this.prisma.course.findUnique({
      where: { id: course.id },
      include: {
        _count: { select: { lessons: true, enrollments: true } },
        lessons: firstLessonIntro,
      },
    });
    if (!full) throw new AppError(404, NOT_FOUND);

    return {
      course: {
        ...toPublicCourse(full),
        isPublished: full.isPublished,
        lessonsCount: full._count.lessons,
        enrollmentsCount: full._count.enrollments,
      },
    };
  }

  async adminUpdate(ref: string, data: z.infer<typeof updateCourseSchema>) {
    const existing = await this.requireRef(ref);

    if (data.slug && data.slug !== existing.slug) {
      const slugTaken = await this.prisma.course.findUnique({ where: { slug: data.slug } });
      if (slugTaken) throw new AppError(409, 'Бул slug эле бар');
    }

    const nextType = data.courseType ?? existing.courseType;
    const course = await this.prisma.course.update({
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
        lessons: firstLessonIntro,
      },
    });

    await this.invalidate();
    return {
      course: {
        ...toPublicCourse(course),
        isPublished: course.isPublished,
        lessonsCount: course._count.lessons,
      },
    };
  }

  async adminDelete(ref: string) {
    const existing = await this.requireRef(ref);
    await this.prisma.course.delete({ where: { id: existing.id } });
    await this.invalidate();
  }

  async adminLessons(ref: string) {
    const course = await this.requireRef(ref);
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId: course.id },
      orderBy: { lessonOrder: 'asc' },
    });

    return lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description,
      youtubeUrl: lesson.youtubeUrl,
      youtubeVideoId: lesson.youtubeVideoId,
      durationSeconds: lesson.durationSeconds,
      lessonOrder: lesson.lessonOrder,
      isPublished: lesson.isPublished,
    }));
  }

  async importPlaylist(ref: string, data: z.infer<typeof importPlaylistSchema>) {
    const course = await this.requireRef(ref);

    let videos;
    try {
      videos = await fetchYoutubePlaylistVideos(data.playlistUrl);
    } catch (err) {
      throw new AppError(400, err instanceof Error ? err.message : 'Плейлист жүктөлгөн жок');
    }
    const replace = Boolean(data.replace);

    const result = await this.prisma.$transaction(async (tx) => {
      if (replace) {
        await tx.lesson.deleteMany({ where: { courseId: course.id } });
      }

      const existing = await tx.lesson.findMany({
        where: { courseId: course.id },
        select: { youtubeVideoId: true, lessonOrder: true },
      });
      const existingIds = new Set(existing.map((lesson) => lesson.youtubeVideoId));
      const startOrder = existing.reduce((max, lesson) => Math.max(max, lesson.lessonOrder), 0);

      const toCreate = videos
        .filter((video) => !existingIds.has(video.videoId))
        .map((video, index) => ({
          courseId: course.id,
          title: video.title.slice(0, 255),
          description: null as string | null,
          youtubeUrl: video.youtubeUrl,
          youtubeVideoId: video.videoId,
          durationSeconds: video.durationSeconds,
          lessonOrder: startOrder + index + 1,
          isPublished: true,
        }));

      if (toCreate.length > 0) {
        await tx.lesson.createMany({ data: toCreate });
      }

      return {
        imported: toCreate.length,
        skipped: videos.length - toCreate.length,
        total: videos.length,
      };
    });

    await this.invalidate();
    return result;
  }
}
