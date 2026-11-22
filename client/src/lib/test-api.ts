import { parseApiErrorResponse } from './api-errors';

export type PublicTestOption = {
  id: string;
  optionText: string;
  optionOrder: number;
  label: string;
};

export type PublicTestQuestion = {
  id: string;
  questionType: 'choice' | 'text';
  questionText: string;
  options?: PublicTestOption[];
};

export type CourseTestPayload = {
  id: string;
  title: string;
  passingScore: number;
  questions: PublicTestQuestion[];
  locked?: boolean;
  lockedUntil?: string | null;
  remainingAttempts?: number;
  failedInWindow?: number;
  /** Sent by the server (QA H-2) when the course's lessons are not all completed yet; the
   * exam then has no questions and is closed. Absent on older servers. */
  lessonsComplete?: boolean;
  lessonsRequired?: { total: number; done: number };
};

export type GradeTestAnswer = {
  questionId: string;
  selectedOptionId?: string;
  textAnswer?: string;
};

/** The API only reports the overall result — never per-question correctness or
 * the answer key (QA H-1). */
export type GradeTestResult = {
  scorePercent: number;
  passed: boolean;
  total: number;
  locked?: boolean;
  lockedUntil?: string | null;
  remainingAttempts?: number;
  failedInWindow?: number;
};

const API_BASE = import.meta.env.VITE_API_URL ?? '';

function authHeaders(token?: string | null): HeadersInit {
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

export async function fetchCourseFinalTest(
  courseRef: string,
  token?: string | null,
): Promise<CourseTestPayload | null> {
  // A GET has no body: no Content-Type, so an anonymous request needs no CORS preflight.
  const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(courseRef)}/final-test`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? 'Тест жүктөлбөдү');
  }
  return res.json() as Promise<CourseTestPayload>;
}

export class TestLockedError extends Error {
  lockedUntil: string | null;

  constructor(message: string, lockedUntil: string | null) {
    super(message);
    this.name = 'TestLockedError';
    this.lockedUntil = lockedUntil;
  }
}

export async function gradeCourseFinalTest(
  courseRef: string,
  answers: GradeTestAnswer[],
  token?: string | null,
): Promise<GradeTestResult> {
  const res = await fetch(
    `${API_BASE}/api/courses/${encodeURIComponent(courseRef)}/final-test/grade`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ answers }),
    },
  );
  if (res.status === 423) {
    const data = (await res.json().catch(() => null)) as
      | (GradeTestResult & { error?: string })
      | null;
    throw new TestLockedError(
      data?.error ?? 'Тесттен 3 жолу өтпөдүңүз. Даярданып, кайрадан тест тапшырыңыз.',
      data?.lockedUntil ?? null,
    );
  }
  if (!res.ok) {
    // e.g. 403 with code LESSONS_INCOMPLETE (QA H-2) — the page reads status and code.
    throw await parseApiErrorResponse(res, 'Тест тапшырылган жок');
  }
  return (await res.json()) as GradeTestResult;
}
