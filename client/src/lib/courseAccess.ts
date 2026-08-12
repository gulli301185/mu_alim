export const PAID_COURSES_KEY = 'mualim-paid-courses';
export const COURSE_PROGRESS_KEY = 'mualim-course-progress';

export type CourseProgress = {
  completedLessonIds: string[];
};

export type AllCourseProgress = Record<string, CourseProgress>;

export function loadPaidCourses(): string[] {
  try {
    const raw = localStorage.getItem(PAID_COURSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function savePaidCourse(courseId: string) {
  const paid = loadPaidCourses();
  if (!paid.includes(courseId)) {
    localStorage.setItem(PAID_COURSES_KEY, JSON.stringify([...paid, courseId]));
  }
}

export function isCoursePaid(courseId: string): boolean {
  return loadPaidCourses().includes(courseId);
}

export function loadAllProgress(): AllCourseProgress {
  try {
    const raw = localStorage.getItem(COURSE_PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function loadCourseProgress(courseId: string): CourseProgress {
  return loadAllProgress()[courseId] ?? { completedLessonIds: [] };
}

export function saveCourseProgress(courseId: string, progress: CourseProgress) {
  const all = loadAllProgress();
  all[courseId] = progress;
  localStorage.setItem(COURSE_PROGRESS_KEY, JSON.stringify(all));
}

export function markLessonComplete(courseId: string, lessonId: string) {
  const progress = loadCourseProgress(courseId);
  if (progress.completedLessonIds.includes(lessonId)) return progress;
  const next = {
    completedLessonIds: [...progress.completedLessonIds, lessonId],
  };
  saveCourseProgress(courseId, next);
  return next;
}
