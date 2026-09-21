import { Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error';
import { AuthUser, assertUserRole } from '../common/auth';
import { CoursesService } from '../courses/courses.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
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

  async get(user: AuthUser | undefined, ref: string) {
    const { userId, courseId } = await this.authorize(user, ref);

    const [enrollment, courseProgress, lessonRows] = await Promise.all([
      this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { enrolledAt: true, completedAt: true, status: true },
      }),
      this.prisma.courseProgress.findUnique({
        where: { userId_courseId: { userId, courseId } },
        select: { isCompleted: true, progressPercent: true },
      }),
      this.prisma.lessonProgress.findMany({
        where: { userId, isLessonCompleted: true, lesson: { courseId, isPublished: true } },
        select: { lessonId: true },
      }),
    ]);

    return {
      completedLessonIds: lessonRows.map((row) => row.lessonId),
      isCompleted: Boolean(courseProgress?.isCompleted || enrollment?.completedAt),
      enrolledAt: enrollment?.enrolledAt?.toISOString() ?? null,
    };
  }

  async completeLesson(user: AuthUser | undefined, ref: string, lessonId: string) {
    const { userId, courseId } = await this.authorize(user, ref);

    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, courseId, isPublished: true },
      select: { id: true, lessonOrder: true },
    });
    if (!lesson) throw new AppError(404, 'Сабак табылган жок');

    if (lesson.lessonOrder > 1) {
      const previous = await this.prisma.lesson.findFirst({
        where: { courseId, isPublished: true, lessonOrder: lesson.lessonOrder - 1 },
        select: { id: true },
      });
      if (previous) {
        const prevDone = await this.prisma.lessonProgress.findUnique({
          where: { userId_lessonId: { userId, lessonId: previous.id } },
          select: { isLessonCompleted: true },
        });
        if (!prevDone?.isLessonCompleted) throw new AppError(400, 'Мурунку сабакты бүтүрүңүз');
      }
    }

    const now = new Date();
    const [lessons, completedRows] = await this.prisma.$transaction(async (tx) => {
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
        create: {
          userId,
          lessonId: lesson.id,
          isVideoCompleted: true,
          isLessonCompleted: true,
          completedAt: now,
        },
        update: { isVideoCompleted: true, isLessonCompleted: true, completedAt: now },
      });

      const published = await tx.lesson.findMany({
        where: { courseId, isPublished: true },
        select: { id: true },
        orderBy: { lessonOrder: 'asc' },
      });
      const done = await tx.lessonProgress.count({
        where: {
          userId,
          isLessonCompleted: true,
          lessonId: { in: published.map((item) => item.id) },
        },
      });
      const percent = published.length ? Math.round((done / published.length) * 100) : 0;
      const allDone = published.length > 0 && done >= published.length;

      await tx.courseProgress.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: {
          userId,
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

      const rows = await tx.lessonProgress.findMany({
        where: {
          userId,
          isLessonCompleted: true,
          lessonId: { in: published.map((item) => item.id) },
        },
        select: { lessonId: true },
      });

      return [published, rows] as const;
    });

    return {
      completedLessonIds: completedRows.map((row) => row.lessonId),
      totalLessons: lessons.length,
    };
  }

  async sync(user: AuthUser | undefined, ref: string, body: unknown) {
    const { userId, courseId } = await this.authorize(user, ref);

    const rawIds = (body as { completedLessonIds?: unknown } | undefined)?.completedLessonIds;
    const requested = Array.isArray(rawIds)
      ? (rawIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : [];

    const published = await this.prisma.lesson.findMany({
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

    const completedRows = await this.prisma.$transaction(async (tx) => {
      for (const lesson of toComplete) {
        await tx.lessonProgress.upsert({
          where: { userId_lessonId: { userId, lessonId: lesson.id } },
          create: {
            userId,
            lessonId: lesson.id,
            isVideoCompleted: true,
            isLessonCompleted: true,
            completedAt: now,
          },
          update: { isVideoCompleted: true, isLessonCompleted: true, completedAt: now },
        });
      }

      const done = toComplete.length;
      const percent = published.length ? Math.round((done / published.length) * 100) : 0;
      const allDone = published.length > 0 && done >= published.length;
      const lastLessonId = toComplete.at(-1)?.id ?? null;

      await tx.courseProgress.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: {
          userId,
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
          where: { userId, courseId, status: 'active' },
          data: { completedAt: now },
        });
      }

      return tx.lessonProgress.findMany({
        where: {
          userId,
          isLessonCompleted: true,
          lessonId: { in: published.map((item) => item.id) },
        },
        select: { lessonId: true },
      });
    });

    return { completedLessonIds: completedRows.map((row) => row.lessonId) };
  }
}
