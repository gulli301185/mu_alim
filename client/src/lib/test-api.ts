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
};

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function fetchCourseFinalTest(courseRef: string): Promise<CourseTestPayload | null> {
  const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(courseRef)}/final-test`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? 'Тест жүктөлбөдү');
  }
  return res.json() as Promise<CourseTestPayload>;
}

export async function gradeCourseFinalTest(
  courseRef: string,
  answers: GradeTestAnswer[],
): Promise<GradeTestResult> {
  const res = await fetch(
    `${API_BASE}/api/courses/${encodeURIComponent(courseRef)}/final-test/grade`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    },
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? 'Тест тапшырылган жок');
  }
  return res.json() as Promise<GradeTestResult>;
}
