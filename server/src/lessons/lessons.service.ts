import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { AuthUser } from '../common/auth';
import { CacheService } from '../cache/cache.service';
import { CoursesService } from '../courses/courses.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Course, Lesson } from '../database/entities';
import { parseYoutubeVideoId } from '../lib/youtube-parse';

export const createLessonSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  youtubeUrl: z.string().trim().min(1).max(500),
  durationSeconds: z.number().int().positive().optional(),
  lessonOrder: z.number().int().positive(),
  isPublished: z.boolean().optional().default(true),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().nullable().optional(),
  youtubeUrl: z.string().trim().min(1).max(500).optional(),
  durationSeconds: z.number().int().positive().nullable().optional(),
  lessonOrder: z.number().int().positive().optional(),
  isPublished: z.boolean().optional(),
});

type LessonRow = {
  id: string;
  title: string;
  description: string | null;
  youtubeVideoId: string;
  durationSeconds: number | null;
  lessonOrder: number;
  isPublished: boolean;
};

const ORDER_TAKEN = 'Бул сабак номери бу курс үчүн эле колдонулган';
const BAD_YOUTUBE = 'YouTube шилтемеси туура эмес';

function toDto(lesson: LessonRow, options?: { hideVideo?: boolean }) {
  const hideVideo = Boolean(options?.hideVideo);
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    youtubeVideoId: hideVideo ? null : lesson.youtubeVideoId,
    durationSeconds: lesson.durationSeconds,
    lessonOrder: lesson.lessonOrder,
    isPublished: lesson.isPublished,
    locked: hideVideo,
  };
}

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson) private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(Course) private readonly courseRepo: Repository<Course>,
    private readonly cache: CacheService,
    private readonly courses: CoursesService,
  ) {}

  async listForCourse(ref: string, user: AuthUser | undefined) {
    // The lesson list itself is shared across users; only the `locked` view depends on the caller.
    const data = await this.cache.wrap(`courses:lessons:${ref}`, 300, async () => {
      const courseId = await this.courses.resolveId(ref);
      if (!courseId) return null;

      const course = await this.courseRepo.findOne({
        where: { id: courseId },
        select: { id: true, courseType: true },
      });
      if (!course) return null;

      const lessons = await this.lessonRepo.find({
        where: { courseId: course.id, isPublished: true },
        order: { lessonOrder: 'ASC' },
        select: {
          id: true,
          title: true,
          description: true,
          youtubeVideoId: true,
          durationSeconds: true,
          lessonOrder: true,
          isPublished: true,
        },
      });
      return { courseId: course.id, courseType: course.courseType, lessons };
    });
    if (!data) throw new AppError(404, 'Курс табылган жок');

    const canWatch =
      data.courseType === 'free' || (await this.courses.userCanWatchPaidCourse(user, data.courseId));

    return data.lessons.map((lesson) => toDto(lesson, { hideVideo: !canWatch }));
  }

  async create(ref: string, data: z.infer<typeof createLessonSchema>) {
    const courseId = await this.courses.resolveId(ref);
    if (!courseId) throw new AppError(404, 'Курс табылган жок');

    const videoId = parseYoutubeVideoId(data.youtubeUrl);
    if (!videoId) throw new AppError(400, BAD_YOUTUBE);

    const orderTaken = await this.lessonRepo.findOne({
      where: { courseId, lessonOrder: data.lessonOrder },
      select: { id: true },
    });
    if (orderTaken) throw new AppError(400, ORDER_TAKEN);

    const lesson = await this.lessonRepo.save(
      this.lessonRepo.create({
        courseId,
        title: data.title,
        description: data.description ?? null,
        youtubeUrl: data.youtubeUrl,
        youtubeVideoId: videoId,
        durationSeconds: data.durationSeconds ?? null,
        lessonOrder: data.lessonOrder,
        isPublished: data.isPublished ?? false,
      }),
    );

    await this.courses.invalidate();
    return toDto(lesson);
  }

  async update(id: string, data: z.infer<typeof updateLessonSchema>) {
    const existing = await this.lessonRepo.findOneBy({ id });
    if (!existing) throw new AppError(404, 'Сабак табылган жок');

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
      if (!videoId) throw new AppError(400, BAD_YOUTUBE);
      updateData.youtubeUrl = data.youtubeUrl;
      updateData.youtubeVideoId = videoId;
    }

    if (data.lessonOrder !== undefined) {
      const orderTaken = await this.lessonRepo.findOne({
        where: { courseId: existing.courseId, lessonOrder: data.lessonOrder, id: Not(existing.id) },
        select: { id: true },
      });
      if (orderTaken) throw new AppError(400, ORDER_TAKEN);
      updateData.lessonOrder = data.lessonOrder;
    }

    const lesson = await this.lessonRepo.save(Object.assign(existing, updateData));
    await this.courses.invalidate();
    return toDto(lesson);
  }

  async remove(id: string) {
    const existing = await this.lessonRepo.findOne({ where: { id }, select: { id: true } });
    if (!existing) throw new AppError(404, 'Сабак табылган жок');

    await this.lessonRepo.delete({ id: existing.id });
    await this.courses.invalidate();
  }
}
