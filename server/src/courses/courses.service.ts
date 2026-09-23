import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { AuthUser } from '../common/auth';
import { UUID_RE } from '../common/uuid';
import { CacheService } from '../cache/cache.service';
import { Category, Course, Enrollment, Lesson } from '../database/entities';
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
  price: number;
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

type CourseWithIntro<T> = T & {
  _count: { lessons: number };
  lessons: { youtubeVideoId: string; durationSeconds: number | null }[];
};

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly courseRepo: Repository<Course>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(Lesson) private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    private readonly ds: DataSource,
    private readonly cache: CacheService,
  ) {}

  /** Everything derived from courses/lessons (and course titles embedded in reviews) is dropped together. */
  invalidate() {
    return this.cache.invalidate('courses:', 'reviews:');
  }

  async resolveRef(ref: string) {
    if (UUID_RE.test(ref)) {
      const byId = await this.courseRepo.findOneBy({ id: ref });
      if (byId) return byId;
    }
    return this.courseRepo.findOneBy({ slug: ref });
  }

  async resolveId(ref: string) {
    if (UUID_RE.test(ref)) {
      const byId = await this.courseRepo.findOne({ where: { id: ref }, select: { id: true } });
      if (byId) return byId.id;
    }
    const bySlug = await this.courseRepo.findOne({ where: { slug: ref }, select: { id: true } });
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

    const enrollment = await this.enrollments.findOne({
      where: [
        { userId: user.id, courseId, status: 'active' },
        { userId: user.id, courseId, status: 'completed' },
      ],
      select: { status: true },
    });

    return Boolean(enrollment);
  }

  /** Attaches the lesson count and the first lesson (for the intro video) to each course. */
  private async withIntro<T extends { id: string }>(
    courses: T[],
    publishedOnly: boolean,
  ): Promise<CourseWithIntro<T>[]> {
    if (courses.length === 0) return [];
    const ids = courses.map((course) => course.id);
    const filter = publishedOnly ? 'AND is_published = true' : '';

    const [counts, firsts] = await Promise.all([
      this.ds.query(
        `SELECT course_id AS "courseId", COUNT(*)::int AS n FROM lessons
         WHERE course_id = ANY($1::uuid[]) ${filter} GROUP BY course_id`,
        [ids],
      ) as Promise<{ courseId: string; n: number }[]>,
      this.ds.query(
        `SELECT DISTINCT ON (course_id) course_id AS "courseId",
                youtube_video_id AS "youtubeVideoId", duration_seconds AS "durationSeconds"
         FROM lessons WHERE course_id = ANY($1::uuid[]) ${filter}
         ORDER BY course_id, lesson_order`,
        [ids],
      ) as Promise<{ courseId: string; youtubeVideoId: string; durationSeconds: number | null }[]>,
    ]);

    const countBy = new Map(counts.map((row) => [row.courseId, row.n]));
    const firstBy = new Map(firsts.map((row) => [row.courseId, row]));
    return courses.map((course) => {
      const first = firstBy.get(course.id);
      return {
        ...course,
        _count: { lessons: countBy.get(course.id) ?? 0 },
        lessons: first
          ? [{ youtubeVideoId: first.youtubeVideoId, durationSeconds: first.durationSeconds }]
          : [],
      };
    });
  }

  private async enrollmentCounts(courseIds: string[]) {
    if (courseIds.length === 0) return new Map<string, number>();
    const rows: { courseId: string; n: number }[] = await this.ds.query(
      `SELECT course_id AS "courseId", COUNT(*)::int AS n FROM enrollments
       WHERE course_id = ANY($1::uuid[]) GROUP BY course_id`,
      [courseIds],
    );
    return new Map(rows.map((row) => [row.courseId, row.n]));
  }

  // ─── Public ────────────────────────────────────────────────────────────────

  freeLessons() {
    return this.cache.wrap('courses:free-lessons', CACHE_TTL, async () => {
      const lessons = await this.lessonRepo
        .createQueryBuilder('l')
        .innerJoinAndSelect('l.course', 'c')
        .where('l.isPublished = true')
        .andWhere("c.courseType = 'free'")
        .andWhere('c.isPublished = true')
        .orderBy('c.title', 'ASC')
        .addOrderBy('l.lessonOrder', 'ASC')
        .getMany();

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
      const where = { isPublished: true, ...(type ? { courseType: type } : {}) };

      const [total, courses] = await Promise.all([
        this.courseRepo.countBy(where),
        this.courseRepo.find({
          where,
          order: { isPopular: 'DESC', title: 'ASC' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return {
        items: (await this.withIntro(courses, true)).map(toPublicCourse),
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

      const [full] = await this.withIntro([course], true);
      return { course: toPublicCourse(full) };
    });

    if (!result) throw new AppError(404, NOT_FOUND);
    return result;
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async adminList({ type, page, limit }: ListQuery) {
    const where = type ? { courseType: type } : {};

    const [total, courses] = await Promise.all([
      this.courseRepo.countBy(where),
      this.courseRepo.find({
        where,
        order: { courseType: 'ASC', title: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const [enriched, enrollments] = await Promise.all([
      this.withIntro(courses, false),
      this.enrollmentCounts(courses.map((course) => course.id)),
    ]);

    return {
      items: enriched.map((course) => ({
        ...toPublicCourse({ ...course, lessons: [] }),
        isPublished: course.isPublished,
        enrollmentsCount: enrollments.get(course.id) ?? 0,
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
    const category = await this.categories.findOneBy({ slug });
    if (category) return category.id;
    const created = await this.categories.save(
      this.categories.create({
        slug,
        name: courseType === 'free' ? 'Бекер курстар' : 'Акы төлөнүүчү курстар',
        description: null,
        isActive: true,
      }),
    );
    return created.id;
  }

  async adminCreate(data: z.infer<typeof createCourseSchema>) {
    const slug = data.slug?.trim() || slugify(data.title);
    const exists = await this.courseRepo.findOneBy({ slug });
    if (exists) throw new AppError(409, 'Бул slug эле бар');

    const courseType = data.courseType;
    const course = await this.courseRepo.save(
      this.courseRepo.create({
        categoryId: await this.defaultCategoryId(courseType),
        title: data.title,
        slug,
        description: data.description,
        shortDescription: data.shortDescription ?? null,
        coverImage: null,
        courseType,
        price: courseType === 'free' ? 0 : (data.price ?? 0),
        currency: data.currency ?? 'KGS',
        level: data.level ?? null,
        durationMinutes: null,
        passingScore: 80,
        isPublished: data.isPublished ?? false,
        isPopular: data.isPopular ?? false,
        publishedAt: data.isPublished ? new Date() : null,
      }),
    );

    await this.invalidate();
    return {
      course: {
        ...toPublicCourse({ ...course, lessons: [] }),
        isPublished: course.isPublished,
        lessonsCount: 0,
      },
    };
  }

  async adminGet(ref: string) {
    const course = await this.requireRef(ref);
    const [full] = await this.withIntro([course], false);
    const enrollments = await this.enrollmentCounts([course.id]);

    return {
      course: {
        ...toPublicCourse(full),
        isPublished: full.isPublished,
        lessonsCount: full._count.lessons,
        enrollmentsCount: enrollments.get(course.id) ?? 0,
      },
    };
  }

  async adminUpdate(ref: string, data: z.infer<typeof updateCourseSchema>) {
    const existing = await this.requireRef(ref);

    if (data.slug && data.slug !== existing.slug) {
      const slugTaken = await this.courseRepo.findOneBy({ slug: data.slug });
      if (slugTaken) throw new AppError(409, 'Бул slug эле бар');
    }

    const nextType = data.courseType ?? existing.courseType;
    if (data.title !== undefined) existing.title = data.title;
    if (data.slug !== undefined) existing.slug = data.slug;
    if (data.description !== undefined) existing.description = data.description;
    if (data.shortDescription !== undefined) existing.shortDescription = data.shortDescription;
    if (data.courseType !== undefined) existing.courseType = data.courseType;
    if (data.price !== undefined) existing.price = nextType === 'free' ? 0 : data.price;
    if (data.currency !== undefined) existing.currency = data.currency;
    if (data.level !== undefined) existing.level = data.level;
    if (data.isPopular !== undefined) existing.isPopular = data.isPopular;
    if (data.isPublished !== undefined) {
      existing.isPublished = data.isPublished;
      existing.publishedAt = data.isPublished ? new Date() : null;
    }
    const saved = await this.courseRepo.save(existing);
    const [course] = await this.withIntro([saved], false);

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
    await this.courseRepo.delete({ id: existing.id });
    await this.invalidate();
  }

  async adminLessons(ref: string) {
    const course = await this.requireRef(ref);
    const lessons = await this.lessonRepo.find({
      where: { courseId: course.id },
      order: { lessonOrder: 'ASC' },
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

    const result = await this.ds.transaction(async (em) => {
      if (replace) {
        await em.delete(Lesson, { courseId: course.id });
      }

      const existing = await em.find(Lesson, {
        where: { courseId: course.id },
        select: { youtubeVideoId: true, lessonOrder: true },
      });
      const existingIds = new Set(existing.map((lesson) => lesson.youtubeVideoId));
      const startOrder = existing.reduce((max, lesson) => Math.max(max, lesson.lessonOrder), 0);

      const toCreate = videos
        .filter((video) => !existingIds.has(video.videoId))
        .map((video, index) =>
          em.create(Lesson, {
            courseId: course.id,
            title: video.title.slice(0, 255),
            description: null,
            youtubeUrl: video.youtubeUrl,
            youtubeVideoId: video.videoId,
            durationSeconds: video.durationSeconds,
            lessonOrder: startOrder + index + 1,
            isPublished: true,
          }),
        );

      if (toCreate.length > 0) {
        await em.save(toCreate);
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
