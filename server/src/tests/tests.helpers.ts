import type { Prisma } from '@prisma/client';
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
  if (orders.size !== 4) return 'А, Б, В, Г варианттарынын баары керек';
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
    passingScore: Prisma.Decimal;
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

  let correct = 0;
  const details = questionItems.map((question) => {
    const answer = answerMap.get(question.id);

    if (question.questionType === 'choice') {
      const selectedOptionId = answer?.selectedOptionId;
      const selected = question.options.find((o) => o.id === selectedOptionId);
      const correctOption = question.options.find((o) => o.isCorrect);
      const isCorrect = Boolean(selected?.isCorrect);
      if (isCorrect) correct += 1;
      return {
        questionId: question.id,
        questionType: question.questionType,
        questionText: question.questionText,
        isCorrect,
        selectedOptionId: selectedOptionId ?? null,
        textAnswer: null,
        correctOptionId: correctOption?.id ?? null,
        correctTextAnswer: null,
        correctOptionText: correctOption?.optionText ?? null,
      };
    }

    const userText = answer?.textAnswer ?? '';
    const isCorrect =
      normalizeTextAnswer(userText) === normalizeTextAnswer(question.correctTextAnswer ?? '');
    if (isCorrect) correct += 1;
    return {
      questionId: question.id,
      questionType: question.questionType,
      questionText: question.questionText,
      isCorrect,
      selectedOptionId: null,
      textAnswer: userText,
      correctOptionId: null,
      correctTextAnswer: question.correctTextAnswer,
      correctOptionText: null,
    };
  });

  const total = questionItems.length;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const passed = scorePercent >= Number(test.passingScore);

  return {
    scorePercent,
    passed,
    correct,
    total,
    passingScore: Number(test.passingScore),
    details,
  };
}
