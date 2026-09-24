export const PAID_COURSES_KEY = 'mualim-paid-courses';
export const COURSE_PROGRESS_KEY = 'mualim-course-progress';

/** Акылуу курстар үчүн WhatsApp төлөмү керек — доступ сервердеги enrollment аркылуу */
export const COURSE_PAYMENT_REQUIRED = true;

export const PASS_THRESHOLD = 0.9;
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

export function savePaidCourse(courseId: string, userId?: string | null) {
  const paid = loadPaidCourses();
  if (!paid.includes(courseId)) {
    localStorage.setItem(PAID_COURSES_KEY, JSON.stringify([...paid, courseId]));
    saveCourseProgress(courseId, { completedLessonIds: [] }, userId);
  }
}

export function isCoursePaid(_courseId: string): boolean {
  return false;
}

export function hasCourseLearningAccess(_courseId: string, isFree: boolean): boolean {
  if (!COURSE_PAYMENT_REQUIRED) return true;
  return isFree;
}

function progressStorageKey(userId?: string | null) {
  return userId ? `${COURSE_PROGRESS_KEY}:${userId}` : null;
}

function readProgressMap(storageKey: string): AllCourseProgress {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function loadAllProgress(userId?: string | null): AllCourseProgress {
  const key = progressStorageKey(userId);
  if (!key) return {};
  return readProgressMap(key);
}

function mergeProgressRecords(records: Array<CourseProgress | undefined>): CourseProgress {
  const completed = new Set<string>();
  let merged: CourseProgress = { completedLessonIds: [] };

  for (const record of records) {
    if (!record) continue;
    for (const id of record.completedLessonIds ?? []) {
      if (id) completed.add(id);
    }
    merged = {
      ...merged,
      ...record,
      completedLessonIds: [...completed],
      lessonScores: { ...(merged.lessonScores ?? {}), ...(record.lessonScores ?? {}) },
      finalTestPassed: Boolean(merged.finalTestPassed || record.finalTestPassed),
      finalTestScore: Math.max(merged.finalTestScore ?? 0, record.finalTestScore ?? 0) || record.finalTestScore,
      certificateNumber: merged.certificateNumber ?? record.certificateNumber,
      certificateIssuedAt: merged.certificateIssuedAt ?? record.certificateIssuedAt,
    };
  }

  merged.completedLessonIds = [...completed];
  return merged;
}

export function loadCourseProgress(
  courseId: string,
  userId?: string | null,
  options?: { aliases?: string[]; adoptLegacy?: boolean },
): CourseProgress {
  if (!userId) return { completedLessonIds: [] };

  const refs = [courseId, ...(options?.aliases ?? [])].filter(Boolean);
  const scoped = loadAllProgress(userId);
  const scopedRecords = refs.map((ref) => scoped[ref]);
  const hasScoped = scopedRecords.some((record) => record);

  // Scoped-only: never merge the old global key into another account.
  // Drop any leftover global progress so shared phones cannot leak progress.
  if (options?.adoptLegacy !== false) {
    try {
      localStorage.removeItem(COURSE_PROGRESS_KEY);
    } catch {
      /* ignore */
    }
  }

  const merged = mergeProgressRecords(scopedRecords);
  if (merged.completedLessonIds.length || hasScoped) {
    saveCourseProgress(courseId, merged, userId);
    return merged;
  }

  return { completedLessonIds: [] };
}

export function saveCourseProgress(
  courseId: string,
  progress: CourseProgress,
  userId?: string | null,
) {
  const key = progressStorageKey(userId);
  if (!key) return;
  const all = loadAllProgress(userId);
  all[courseId] = progress;
  localStorage.setItem(key, JSON.stringify(all));
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
  const score = progress.finalTestScore ?? 0;
  return Boolean(progress.finalTestPassed) && score >= CERTIFICATE_THRESHOLD * 100;
}

export function markFinalTestResult(
  courseId: string,
  passed: boolean,
  scorePercent: number,
  userId?: string | null,
): CourseProgress {
  const progress = loadCourseProgress(courseId, userId);
  const certificatePassed = passed && scorePercent >= CERTIFICATE_THRESHOLD * 100;
  const next: CourseProgress = {
    ...progress,
    finalTestPassed: certificatePassed,
    finalTestScore: Math.max(progress.finalTestScore ?? 0, scorePercent),
  };
  saveCourseProgress(courseId, next, userId);
  return next;
}

export function markLessonComplete(
  courseId: string,
  lessonId: string,
  scorePercent?: number,
  userId?: string | null,
): CourseProgress {
  const progress = loadCourseProgress(courseId, userId);
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
  saveCourseProgress(courseId, next, userId);
  return next;
}

export function ensureCertificateMeta(
  courseId: string,
  certificateNumber: string,
  userId?: string | null,
): CourseProgress {
  const progress = loadCourseProgress(courseId, userId);
  if (progress.certificateNumber) return progress;

  const next: CourseProgress = {
    ...progress,
    certificateNumber,
    certificateIssuedAt: new Date().toISOString(),
  };
  saveCourseProgress(courseId, next, userId);
  return next;
}
