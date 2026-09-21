import { Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error';
import { AuthUser, assertUserRole } from '../common/auth';
import { CoursesService } from '../courses/courses.service';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  CourseProgress,
  Enrollment,
  Lesson,
  LessonProgress,
} from '../database/entities';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(Lesson) private readonly lessons: Repository<Lesson>,
    @InjectRepository(Enrollment) private readonly enrollments: Repository<Enrollment>,
    @InjectRepository(CourseProgress) private readonly courseProgress: Repository<CourseProgress>,
    @InjectRepository(LessonProgress) private readonly lessonProgress: Repository<LessonProgress>,
    private readonly ds: DataSource,
    private readonly courses: CoursesService,
  ) {}

  /** Shared preamble: caller must be a `user` account with access to the (resolved) course. */
  private async authorize(user: AuthUser | undefined, ref: string) {
    assertUserRole(user);

    const courseId = await this.courses.resolveId(ref);
    if (!courseId) throw new AppError(404, 'Курс табылган жок');

    const canWatch = await this.courses.userCanWatchPaidCourse(user, courseId);
    if (!canWatch) throw new AppError(403, 'Курс ачыла элек');

    return { userId: user.id, courseId };
  }

  private markLessonDone(em: EntityManager, userId: string, lessonId: string, now: Date) {
    return em
      .createQueryBuilder()
      .insert()
      .into(LessonProgress)
      .values({
        id: randomUUID(),
        userId,
        lessonId,
        isVideoCompleted: true,
        isLessonCompleted: true,
        completedAt: now,
        updatedAt: now,
      })
      .orUpdate(
        ['is_video_completed', 'is_lesson_completed', 'completed_at', 'updated_at'],
        ['user_id', 'lesson_id'],
      )
      .execute();
  }

  private saveCourseProgress(
    em: EntityManager,
    row: {
      userId: string;
      courseId: string;
      lastLessonId: string | null;
      percent: number;
      allDone: boolean;
      now: Date;
    },
    /** Sync keeps an existing `completed_at` when the course is not finished yet. */
    keepCompletedAtUnlessDone = false,
  ) {
    const overwrite = ['last_lesson_id', 'progress_percent', 'is_completed', 'updated_at'];
    if (!keepCompletedAtUnlessDone || row.allDone) overwrite.push('completed_at');

    return em
      .createQueryBuilder()
      .insert()
      .into(CourseProgress)
      .values({
        id: randomUUID(),
        userId: row.userId,
        courseId: row.courseId,
        lastLessonId: row.lastLessonId,
        progressPercent: row.percent,
        isCompleted: row.allDone,
        completedAt: row.allDone ? row.now : null,
        updatedAt: row.now,
      })
      .orUpdate(overwrite, ['user_id', 'course_id'])
      .execute();
  }

  private completedIds(em: EntityManager, userId: string, lessonIds: string[]) {
    if (lessonIds.length === 0) return Promise.resolve([] as { lessonId: string }[]);
    return em.find(LessonProgress, {
      where: { userId, isLessonCompleted: true, lessonId: In(lessonIds) },
      select: { lessonId: true },
    });
  }

  async get(user: AuthUser | undefined, ref: string) {
    const { userId, courseId } = await this.authorize(user, ref);

    const [enrollment, progress, lessonRows] = await Promise.all([
      this.enrollments.findOne({
        where: { userId, courseId },
        select: { enrolledAt: true, completedAt: true, status: true },
      }),
      this.courseProgress.findOne({
        where: { userId, courseId },
        select: { isCompleted: true, progressPercent: true },
      }),
      this.lessonProgress.find({
        where: { userId, isLessonCompleted: true, lesson: { courseId, isPublished: true } },
        select: { lessonId: true },
      }),
    ]);

    return {
      completedLessonIds: lessonRows.map((row) => row.lessonId),
      isCompleted: Boolean(progress?.isCompleted || enrollment?.completedAt),
      enrolledAt: enrollment?.enrolledAt?.toISOString() ?? null,
    };
  }

  async completeLesson(user: AuthUser | undefined, ref: string, lessonId: string) {
    const { userId, courseId } = await this.authorize(user, ref);

    const lesson = await this.lessons.findOne({
      where: { id: lessonId, courseId, isPublished: true },
      select: { id: true, lessonOrder: true },
    });
    if (!lesson) throw new AppError(404, 'Сабак табылган жок');

    if (lesson.lessonOrder > 1) {
      const previous = await this.lessons.findOne({
        where: { courseId, isPublished: true, lessonOrder: lesson.lessonOrder - 1 },
        select: { id: true },
      });
      if (previous) {
        const prevDone = await this.lessonProgress.findOne({
          where: { userId, lessonId: previous.id },
          select: { isLessonCompleted: true },
        });
        if (!prevDone?.isLessonCompleted) throw new AppError(400, 'Мурунку сабакты бүтүрүңүз');
      }
    }

    const now = new Date();
    const [published, completedRows] = await this.ds.transaction(async (em) => {
      await this.markLessonDone(em, userId, lesson.id, now);

      const published = await em.find(Lesson, {
        where: { courseId, isPublished: true },
        select: { id: true },
        order: { lessonOrder: 'ASC' },
      });
      const publishedIds = published.map((item) => item.id);
      const rows = await this.completedIds(em, userId, publishedIds);
      const done = rows.length;
      const percent = published.length ? Math.round((done / published.length) * 100) : 0;
      const allDone = published.length > 0 && done >= published.length;

      await this.saveCourseProgress(em, {
        userId,
        courseId,
        lastLessonId: lesson.id,
        percent,
        allDone,
        now,
      });

      return [published, rows] as const;
    });

    return {
      completedLessonIds: completedRows.map((row) => row.lessonId),
      totalLessons: published.length,
    };
  }

  async sync(user: AuthUser | undefined, ref: string, body: unknown) {
    const { userId, courseId } = await this.authorize(user, ref);

    const rawIds = (body as { completedLessonIds?: unknown } | undefined)?.completedLessonIds;
    const requested = Array.isArray(rawIds)
      ? (rawIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];

    const published = await this.lessons.find({
      where: { courseId, isPublished: true },
      select: { id: true, lessonOrder: true },
      order: { lessonOrder: 'ASC' },
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

    const completedRows = await this.ds.transaction(async (em) => {
      for (const lesson of toComplete) {
        await this.markLessonDone(em, userId, lesson.id, now);
      }

      const done = toComplete.length;
      const percent = published.length ? Math.round((done / published.length) * 100) : 0;
      const allDone = published.length > 0 && done >= published.length;

      await this.saveCourseProgress(
        em,
        { userId, courseId, lastLessonId: toComplete.at(-1)?.id ?? null, percent, allDone, now },
        true,
      );

      if (allDone) {
        await em.update(Enrollment, { userId, courseId, status: 'active' }, { completedAt: now });
      }

      return this.completedIds(
        em,
        userId,
        published.map((item) => item.id),
      );
    });

    return { completedLessonIds: completedRows.map((row) => row.lessonId) };
  }
}
