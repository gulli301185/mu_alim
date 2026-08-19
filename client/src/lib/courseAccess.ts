export const PAID_COURSES_KEY = 'mualim-paid-courses';
export const COURSE_PROGRESS_KEY = 'mualim-course-progress';

export const PASS_THRESHOLD = 0.8;
export const CERTIFICATE_THRESHOLD = 0.9;

export type CourseProgress = {
  completedLessonIds: string[];
  lessonScores?: Record<string, number>;
  finalTestPassed?: boolean;
  finalTestScore?: number;
  certificateNumber?: string;
  certificateIssuedAt?: string;
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

export function calcTestScorePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 100);
}

export function getAverageScore(progress: CourseProgress, lessonIds: string[]): number | null {
  const scores = lessonIds
    .map((id) => progress.lessonScores?.[id])
    .filter((score): score is number => typeof score === 'number');
  if (!scores.length) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

export function isCourseFullyComplete(progress: CourseProgress, totalLessons: number): boolean {
  return progress.completedLessonIds.length >= totalLessons;
}

export function isCertificateEligible(
  progress: CourseProgress,
  totalLessons: number,
): boolean {
  if (!isCourseFullyComplete(progress, totalLessons)) return false;
  return Boolean(progress.finalTestPassed);
}

export function markFinalTestResult(
  courseId: string,
  passed: boolean,
  scorePercent: number,
): CourseProgress {
  const progress = loadCourseProgress(courseId);
  const next: CourseProgress = {
    ...progress,
    finalTestPassed: passed,
    finalTestScore: Math.max(progress.finalTestScore ?? 0, scorePercent),
  };
  saveCourseProgress(courseId, next);
  return next;
}

export function markLessonComplete(
  courseId: string,
  lessonId: string,
  scorePercent?: number,
): CourseProgress {
  const progress = loadCourseProgress(courseId);
  const lessonScores = { ...(progress.lessonScores ?? {}) };

  if (scorePercent !== undefined) {
    const previous = lessonScores[lessonId] ?? 0;
    lessonScores[lessonId] = Math.max(previous, scorePercent);
  }

  const completedLessonIds = progress.completedLessonIds.includes(lessonId)
    ? progress.completedLessonIds
    : [...progress.completedLessonIds, lessonId];

  const next: CourseProgress = {
    ...progress,
    completedLessonIds,
    lessonScores,
  };
  saveCourseProgress(courseId, next);
  return next;
}

export function ensureCertificateMeta(
  courseId: string,
  certificateNumber: string,
): CourseProgress {
  const progress = loadCourseProgress(courseId);
  if (progress.certificateNumber) return progress;

  const next: CourseProgress = {
    ...progress,
    certificateNumber,
    certificateIssuedAt: new Date().toISOString(),
  };
  saveCourseProgress(courseId, next);
  return next;
}
