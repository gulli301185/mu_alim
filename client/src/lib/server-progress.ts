import type { CourseLesson } from '../data/courseLessons';

/**
 * QA H-2: for paid courses the server's lesson_progress is the source of truth. These helpers
 * never widen progress (no "everything up to the highest lesson", no "first N lessons") and
 * never send anything to the server.
 */

function inCourseOrder(lessons: readonly CourseLesson[]) {
  return [...lessons].sort((a, b) => a.order - b.order);
}

/** The course's lessons the server has confirmed, in course order; other ids are dropped. */
export function confirmedLessonIds(lessons: readonly CourseLesson[], serverIds: readonly string[]): string[] {
  const confirmed = new Set(serverIds);
  return inCourseOrder(lessons)
    .filter((lesson) => confirmed.has(lesson.id))
    .map((lesson) => lesson.id);
}

/**
 * Lessons marked done only on this device (old local progress the server does not have).
 * Shown as "not confirmed" — never used to open lessons, the exam or a certificate.
 */
export function unconfirmedLessonIds(
  lessons: readonly CourseLesson[],
  localIds: readonly string[],
  serverIds: readonly string[],
): string[] {
  const local = new Set(localIds);
  const server = new Set(serverIds);
  return inCourseOrder(lessons)
    .filter((lesson) => local.has(lesson.id) && !server.has(lesson.id))
    .map((lesson) => lesson.id);
}

type FinalTestLike = { lessonsComplete?: boolean; questions: readonly unknown[] };

/**
 * The exam can be taken: the server did not report unfinished lessons (`lessonsComplete:
 * false` closes it whatever the questions) and there are questions. An older server without
 * `lessonsComplete` falls back to the questions alone.
 */
export function isFinalTestAvailable(test: FinalTestLike | null | undefined): boolean {
  if (!test) return false;
  if (test.lessonsComplete === false) return false;
  return test.questions.length > 0;
}

/**
 * A certificate the server already issued can always be downloaded again; a new one needs
 * the server-confirmed lessons, a final test and a passed attempt at or above `passScore`.
 */
export function isCertificateReadyFromServer(input: {
  hasIssuedCertificate: boolean;
  hasFinalTest: boolean;
  allLessonsConfirmed: boolean;
  finalTestPassed: boolean;
  finalTestScore: number | null | undefined;
  passScore: number;
}): boolean {
  if (input.hasIssuedCertificate) return true;
  return (
    input.hasFinalTest &&
    input.allLessonsConfirmed &&
    input.finalTestPassed &&
    (input.finalTestScore ?? 0) >= input.passScore
  );
}
