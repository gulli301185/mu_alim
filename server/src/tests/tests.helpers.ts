import type { GradeAnswers, QuestionInput } from './tests.schemas';

export const CHOICE_LABELS = ['А', 'Б', 'В', 'Г'] as const;

export const FINAL_TEST_FAIL_LIMIT = 3;
export const FINAL_TEST_LOCK_MS = 24 * 60 * 60 * 1000;

export type TestLockState = {
  locked: boolean;
  lockedUntil: string | null;
  remainingAttempts: number;
  failedInWindow: number;
};

function normalizeTextAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function validateChoiceQuestion(question: QuestionInput) {
  if (question.questionType !== 'choice') return null;
  const correctCount = question.options.filter((o) => o.isCorrect).length;
  if (correctCount !== 1) return 'Тандоо суроосунда бир гана туура жооп болушу керек';
  const orders = new Set(question.options.map((o) => o.optionOrder));
  if (orders.size !== question.options.length) return 'А, Б, В, Г варианттарынын баары керек';
  return null;
}

export function toPublicQuestion(question: {
  id: string;
  questionText: string;
  questionType: 'choice' | 'text';
  options: { id: string; optionText: string; optionOrder: number }[];
}) {
  return {
    id: question.id,
    questionType: question.questionType,
    questionText: question.questionText,
    options:
      question.questionType === 'choice'
        ? [...question.options]
            .sort((a, b) => a.optionOrder - b.optionOrder)
            .map((option) => ({
              id: option.id,
              optionText: option.optionText,
              optionOrder: option.optionOrder,
              label: CHOICE_LABELS[option.optionOrder - 1] ?? String(option.optionOrder),
            }))
        : undefined,
  };
}

export function gradeTestAnswers(
  test: {
    passingScore: number;
    testQuestions: {
      question: {
        id: string;
        questionText: string;
        questionType: 'choice' | 'text';
        correctTextAnswer: string | null;
        options: { id: string; optionText: string; isCorrect: boolean }[];
      };
    }[];
  },
  answers: GradeAnswers,
) {
  const questionItems = test.testQuestions.map((item) => item.question);
  const answerMap = new Map(answers.map((a) => [a.questionId, a]));

  // Only the totals are kept: per-question results or the answer key must never
  // reach the student (QA H-1), so they are not produced at all.
  let correct = 0;
  for (const question of questionItems) {
    const answer = answerMap.get(question.id);
    const isCorrect =
      question.questionType === 'choice'
        ? Boolean(question.options.find((o) => o.id === answer?.selectedOptionId)?.isCorrect)
        : normalizeTextAnswer(answer?.textAnswer ?? '') ===
          normalizeTextAnswer(question.correctTextAnswer ?? '');
    if (isCorrect) correct += 1;
  }

  const total = questionItems.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = scorePercent >= Number(test.passingScore);

  return {
    scorePercent,
    passed,
    correct,
    total,
    passingScore: Number(test.passingScore),
  };
}

/** The final-exam grade response sent to the student: overall score, pass/fail,
 * question count and attempt/lock state only. */
export function toStudentGradeResult(
  result: { scorePercent: number; passed: boolean; total: number } & TestLockState,
) {
  return {
    scorePercent: result.scorePercent,
    passed: result.passed,
    total: result.total,
    locked: result.locked,
    lockedUntil: result.lockedUntil,
    remainingAttempts: result.remainingAttempts,
    failedInWindow: result.failedInWindow,
  };
}
