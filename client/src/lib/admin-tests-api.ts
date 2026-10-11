const API_BASE = import.meta.env.VITE_API_URL ?? '';

export type QuestionType = 'choice' | 'text';

export type AdminTestListItem = {
  id: string;
  title: string;
  passingScore: number;
  questionsCount: number;
  isActive: boolean;
  course: { id: string; title: string; slug: string; courseType: 'paid' };
  lesson: { id: string; title: string; lessonOrder: number } | null;
};

export type AdminTestOption = {
  id?: string;
  optionText: string;
  optionOrder: number;
  isCorrect: boolean;
  label?: string;
};

export type AdminTestQuestion = {
  id?: string;
  questionType: QuestionType;
  questionText: string;
  explanation?: string | null;
  correctTextAnswer?: string | null;
  questionOrder?: number;
  options: AdminTestOption[];
};

export type AdminTestDetail = AdminTestListItem & {
  testType: 'lesson' | 'final';
  questions: AdminTestQuestion[];
};

export type CreateTestQuestionInput =
  | {
      questionType: 'choice';
      questionText: string;
      explanation?: string;
      options: { optionText: string; isCorrect: boolean; optionOrder: number }[];
    }
  | {
      questionType: 'text';
      questionText: string;
      explanation?: string;
      correctTextAnswer: string;
    };

export type CreateTestInput = {
  courseRef: string;
  title?: string;
  passingScore?: number;
  questions: CreateTestQuestionInput[];
};

export type UpdateTestInput = {
  title?: string;
  passingScore?: number;
  isActive?: boolean;
  questions?: CreateTestQuestionInput[];
};

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseApiError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string };
    return new Error(data.error ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function fetchAdminTests(token: string, courseRef?: string) {
  const query = courseRef ? `?course=${encodeURIComponent(courseRef)}` : '';
  const res = await fetch(`${API_BASE}/api/admin/tests${query}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseApiError(res, 'Тесттерди жүктөө ийгиликсиз');
  return res.json() as Promise<{ items: AdminTestListItem[]; total: number }>;
}

export async function fetchAdminTest(token: string, testId: string) {
  const res = await fetch(`${API_BASE}/api/admin/tests/${encodeURIComponent(testId)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseApiError(res, 'Тест жүктөлбөдү');
  const data = (await res.json()) as { test: AdminTestDetail };
  return data.test;
}

export async function createAdminTest(token: string, input: CreateTestInput) {
  const res = await fetch(`${API_BASE}/api/admin/tests`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseApiError(res, 'Тест түзүлбөдү');
  const data = (await res.json()) as { test: AdminTestDetail };
  return data.test;
}

export async function updateAdminTest(token: string, testId: string, input: UpdateTestInput) {
  const res = await fetch(`${API_BASE}/api/admin/tests/${encodeURIComponent(testId)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseApiError(res, 'Тест жаңыртылган жок');
  const data = (await res.json()) as { test: AdminTestDetail };
  return data.test;
}

export async function deleteAdminTest(token: string, testId: string) {
  const res = await fetch(`${API_BASE}/api/admin/tests/${encodeURIComponent(testId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseApiError(res, 'Тест өчүрүлбөдү');
}

export function emptyChoiceQuestion(): CreateTestQuestionInput {
  return {
    questionType: 'choice',
    questionText: '',
    options: [
      { optionText: '', isCorrect: true, optionOrder: 1 },
      { optionText: '', isCorrect: false, optionOrder: 2 },
      { optionText: '', isCorrect: false, optionOrder: 3 },
      { optionText: '', isCorrect: false, optionOrder: 4 },
    ],
  };
}

export function emptyTextQuestion(): CreateTestQuestionInput {
  return {
    questionType: 'text',
    questionText: '',
    correctTextAnswer: '',
  };
}

export const CHOICE_LABELS = ['А', 'Б', 'В', 'Г'] as const;

export const MIN_CHOICE_OPTIONS = 2;
export const MAX_CHOICE_OPTIONS = 4;

export const TRUE_OPTION_TEXT = 'Туура';
export const FALSE_OPTION_TEXT = 'Туура эмес';

/** Two-option choice question: А) Туура, Б) Туура эмес. */
export function trueFalseQuestion(questionText = '', correctIsTrue = true): CreateTestQuestionInput {
  return {
    questionType: 'choice',
    questionText,
    options: [
      { optionText: TRUE_OPTION_TEXT, isCorrect: correctIsTrue, optionOrder: 1 },
      { optionText: FALSE_OPTION_TEXT, isCorrect: !correctIsTrue, optionOrder: 2 },
    ],
  };
}

export function isTrueFalseQuestion(question: CreateTestQuestionInput) {
  return (
    question.questionType === 'choice' &&
    question.options.length === 2 &&
    question.options[0].optionText.trim() === TRUE_OPTION_TEXT &&
    question.options[1].optionText.trim() === FALSE_OPTION_TEXT
  );
}

/** For a text question whose expected answer is just "Туура" / "Туура эмес" (or "Ката"):
 * true / false. Any other text question: null. */
export function textTrueFalseAnswer(question: CreateTestQuestionInput): boolean | null {
  if (question.questionType !== 'text') return null;
  const answer = question.correctTextAnswer.trim().toLowerCase().replace(/\s+/g, ' ');
  if (answer === 'туура') return true;
  if (answer === 'туура эмес' || answer === 'ката') return false;
  return null;
}
