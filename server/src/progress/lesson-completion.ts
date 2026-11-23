import { In, type EntityManager } from "typeorm";
import { Lesson, LessonProgress } from "../database/entities";

export type LessonCompletion = {
  /** Published lessons of the course right now. */
  total: number;
  /** How many of them the server has recorded as completed for the user. */
  done: number;
  /** Every published lesson is completed (a course with no published lessons never is). */
  complete: boolean;
};

/**
 * The one server rule for "the user has finished the course's lessons", shared by the final
 * exam and the certificate (QA H-2). Only `lesson_progress` rows of currently published
 * lessons count; `enrollments.completed_at` and `course_progress.is_completed` are history
 * and never prove completion on their own.
 */
export async function getLessonCompletion(
  em: Pick<EntityManager, "find">,
  userId: string,
  courseId: string,
): Promise<LessonCompletion> {
  const published = await em.find(Lesson, {
    where: { courseId, isPublished: true },
    select: { id: true },
  });
  if (published.length === 0) return { total: 0, done: 0, complete: false };

  const rows = await em.find(LessonProgress, {
    where: {
      userId,
      isLessonCompleted: true,
      lessonId: In(published.map((lesson) => lesson.id)),
    },
    select: { lessonId: true },
  });
  const done = new Set(rows.map((row) => row.lessonId)).size;

  return { total: published.length, done, complete: done === published.length };
}
