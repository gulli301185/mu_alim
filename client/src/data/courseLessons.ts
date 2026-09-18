import type { LessonDto } from '../lib/lesson-api';

export type CourseLesson = {
  id: string;
  order: number;
  title: string;
  duration: string;
  videoId: string | null;
};

export function mapLessonsToCourseLessons(
  apiLessons: LessonDto[],
  _courseTitle: string,
): CourseLesson[] {
  return [...apiLessons]
    .sort((a, b) => a.lessonOrder - b.lessonOrder)
    .map((lesson) => ({
      id: lesson.id,
      order: lesson.lessonOrder,
      title: lesson.title,
      duration: formatDuration(lesson.durationSeconds),
      videoId: lesson.youtubeVideoId,
    }));
}

export function getFirstUnlockedLessonId(
  lessons: CourseLesson[],
  completedLessonIds: string[],
): string | null {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  return (
    sorted.find((lesson) => isLessonUnlocked(lessons, lesson.id, completedLessonIds))?.id ?? null
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function resolveCompletedLessonIds(
  lessons: CourseLesson[],
  storedIds: string[],
): string[] {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  if (!sorted.length || !storedIds.length) return storedIds.filter(Boolean);

  const currentIds = new Set(sorted.map((lesson) => lesson.id));
  const matched = storedIds.filter((id) => currentIds.has(id));

  if (matched.length > 0) {
    const maxOrder = Math.max(
      0,
      ...matched.map((id) => sorted.find((lesson) => lesson.id === id)?.order ?? 0),
    );
    return sorted.filter((lesson) => lesson.order <= maxOrder).map((lesson) => lesson.id);
  }

  const count = Math.min(storedIds.length, sorted.length);
  return sorted.slice(0, count).map((lesson) => lesson.id);
}

export function isLessonUnlocked(
  lessons: CourseLesson[],
  lessonId: string,
  completedLessonIds: string[],
): boolean {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  const lesson = sorted.find((l) => l.id === lessonId);
  if (!lesson) return false;
  if (lesson.order <= 1) return true;

  const prev = sorted.find((l) => l.order === lesson.order - 1);
  if (!prev) return lesson.order <= 1;

  return completedLessonIds.includes(prev.id);
}
