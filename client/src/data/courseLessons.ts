import type { LessonDto } from '../lib/lesson-api';

export type CourseLesson = {
  id: string;
  order: number;
  title: string;
  duration: string;
  videoId: string;
};

export function mapLessonsToCourseLessons(
  apiLessons: LessonDto[],
  _courseTitle: string,
): CourseLesson[] {
  return apiLessons.map((lesson) => ({
    id: lesson.id,
    order: lesson.lessonOrder,
    title: lesson.title,
    duration: formatDuration(lesson.durationSeconds),
    videoId: lesson.youtubeVideoId,
  }));
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function isLessonUnlocked(
  lessons: CourseLesson[],
  lessonId: string,
  completedLessonIds: string[],
): boolean {
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index <= 0) return true;
  const prev = lessons[index - 1];
  return completedLessonIds.includes(prev.id);
}
