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
};

export type GradeTestAnswer = {
  questionId: string;
  selectedOptionId?: string;
  textAnswer?: string;
};

export type GradeTestDetail = {
  questionId: string;
  questionType: 'choice' | 'text';
  questionText: string;
  isCorrect: boolean;
  selectedOptionId: string | null;
  textAnswer: string | null;
  correctOptionId: string | null;
  correctTextAnswer: string | null;
  correctOptionText: string | null;
};

export type GradeTestResult = {
  scorePercent: number;
  passed: boolean;
  correct: number;
  total: number;
  passingScore: number;
  details: GradeTestDetail[];
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
  const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(courseRef)}/final-test`, {
    headers: authHeaders(token),
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
  const data = (await res.json().catch(() => null)) as
    | (GradeTestResult & { error?: string })
    | null;
  if (res.status === 423) {
    throw new TestLockedError(
      data?.error ?? 'Тесттен 3 жолу өтпөдүңүз. Даярданып, кайрадан тест тапшырыңыз.',
      data?.lockedUntil ?? null,
    );
  }
  if (!res.ok) {
    throw new Error(data?.error ?? 'Тест тапшырылган жок');
  }
  return data as GradeTestResult;
}
