import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAdmin } from '../middleware/auth.js';

export const testsRouter = Router();

const CHOICE_LABELS = ['А', 'Б', 'В', 'Г'] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeTextAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const choiceOptionSchema = z.object({
  optionText: z.string().trim().min(1),
  isCorrect: z.boolean(),
  optionOrder: z.number().int().min(1).max(4),
});

const questionInputSchema = z.discriminatedUnion('questionType', [
  z.object({
    questionType: z.literal('choice'),
    questionText: z.string().trim().min(1),
    explanation: z.string().trim().optional(),
    options: z.array(choiceOptionSchema).length(4),
  }),
  z.object({
    questionType: z.literal('text'),
    questionText: z.string().trim().min(1),
    explanation: z.string().trim().optional(),
    correctTextAnswer: z.string().trim().min(1),
  }),
]);

const createTestSchema = z.object({
  courseRef: z.string().trim().min(1),
  title: z.string().trim().min(1).max(255).optional(),
  passingScore: z.number().min(0).max(100).optional(),
  questions: z.array(questionInputSchema).min(1),
});

const updateTestSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  passingScore: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  questions: z.array(questionInputSchema).min(1).optional(),
});

const gradeSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      selectedOptionId: z.string().uuid().optional(),
      textAnswer: z.string().optional(),
    }),
  ),
});

function validateChoiceQuestion(question: z.infer<typeof questionInputSchema>) {
  if (question.questionType !== 'choice') return null;
  const correctCount = question.options.filter((o) => o.isCorrect).length;
  if (correctCount !== 1) return 'Тандоо суроосунда бир гана туура жооп болушу керек';
  const orders = new Set(question.options.map((o) => o.optionOrder));
  if (orders.size !== 4) return 'А, Б, В, Г варианттарынын баары керек';
  return null;
}

async function resolveCourseRef(ref: string) {
  if (UUID_RE.test(ref)) {
    const byId = await prisma.course.findUnique({ where: { id: ref } });
    if (byId) return byId;
  }
  return prisma.course.findUnique({ where: { slug: ref } });
}

function toPublicQuestion(question: {
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
        ? question.options
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

async function getTestWithQuestions(testId: string) {
  return prisma.test.findUnique({
    where: { id: testId },
    include: {
      course: { select: { id: true, title: true, slug: true, courseType: true } },
      lesson: { select: { id: true, title: true, lessonOrder: true } },
      testQuestions: {
        orderBy: { questionOrder: 'asc' },
        include: {
          question: {
            include: {
              options: { orderBy: { optionOrder: 'asc' } },
            },
          },
        },
      },
    },
  });
}

function serializeAdminTest(test: NonNullable<Awaited<ReturnType<typeof getTestWithQuestions>>>) {
  return {
    id: test.id,
    title: test.title,
    testType: test.testType,
    passingScore: Number(test.passingScore),
    questionsCount: test.questionsCount,
    isActive: test.isActive,
    course: test.course,
    lesson: test.lesson,
    questions: test.testQuestions.map((item) => ({
      id: item.question.id,
      questionType: item.question.questionType,
      questionText: item.question.questionText,
      explanation: item.question.explanation,
      correctTextAnswer: item.question.correctTextAnswer,
      questionOrder: item.questionOrder,
      options: item.question.options.map((option) => ({
        id: option.id,
        optionText: option.optionText,
        optionOrder: option.optionOrder,
        isCorrect: option.isCorrect,
        label: CHOICE_LABELS[option.optionOrder - 1] ?? String(option.optionOrder),
      })),
    })),
  };
}

async function findFinalTestForCourse(courseId: string, activeOnly = false) {
  return prisma.test.findFirst({
    where: {
      courseId,
      testType: 'final',
      lessonId: null,
      ...(activeOnly ? { isActive: true, course: { courseType: 'paid' } } : {}),
    },
    include: {
      testQuestions: {
        orderBy: { questionOrder: 'asc' },
        include: {
          question: {
            include: {
              options: { orderBy: { optionOrder: 'asc' } },
            },
          },
        },
      },
    },
  });
}

function gradeTestAnswers(
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
  answers: z.infer<typeof gradeSchema>['answers'],
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

async function createQuestionsForTest(
  tx: Prisma.TransactionClient,
  courseId: string,
  testId: string,
  questions: z.infer<typeof questionInputSchema>[],
) {
  for (const [index, questionInput] of questions.entries()) {
    const question = await tx.question.create({
      data: {
        courseId,
        questionText: questionInput.questionText,
        questionType: questionInput.questionType,
        correctTextAnswer:
          questionInput.questionType === 'text' ? questionInput.correctTextAnswer : null,
        explanation: questionInput.explanation ?? null,
      },
    });

    if (questionInput.questionType === 'choice') {
      await tx.questionOption.createMany({
        data: questionInput.options.map((option) => ({
          questionId: question.id,
          optionText: option.optionText,
          isCorrect: option.isCorrect,
          optionOrder: option.optionOrder,
        })),
      });
    }

    await tx.testQuestion.create({
      data: {
        testId,
        questionId: question.id,
        questionOrder: index + 1,
      },
    });
  }
}

testsRouter.get(
  '/admin/tests',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const courseRef = typeof req.query.course === 'string' ? req.query.course.trim() : undefined;

    const where: Prisma.TestWhereInput = {
      testType: 'final',
      course: { courseType: 'paid' },
    };

    if (courseRef) {
      where.course = {
        courseType: 'paid',
        OR: [{ slug: courseRef }, { id: courseRef }],
      };
    }

    const tests = await prisma.test.findMany({
      where,
      orderBy: [{ course: { title: 'asc' } }],
      include: {
        course: { select: { id: true, title: true, slug: true, courseType: true } },
        lesson: { select: { id: true, title: true, lessonOrder: true } },
      },
    });

    res.json({
      items: tests.map((test) => ({
        id: test.id,
        title: test.title,
        testType: test.testType,
        passingScore: Number(test.passingScore),
        questionsCount: test.questionsCount,
        isActive: test.isActive,
        course: test.course,
        lesson: test.lesson,
      })),
      total: tests.length,
    });
  }),
);

testsRouter.get(
  '/admin/tests/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const test = await getTestWithQuestions(req.params.id);
    if (!test) {
      res.status(404).json({ error: 'Тест табылган жок' });
      return;
    }
    res.json({ test: serializeAdminTest(test) });
  }),
);

testsRouter.post(
  '/admin/tests',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = createTestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    for (const question of parsed.data.questions) {
      const choiceError = validateChoiceQuestion(question);
      if (choiceError) {
        res.status(400).json({ error: choiceError });
        return;
      }
    }

    const course = await resolveCourseRef(parsed.data.courseRef);
    if (!course) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }
    if (course.courseType !== 'paid') {
      res.status(400).json({ error: 'Тесттер акылуу курстар үчүн гана түзүлөт' });
      return;
    }

    const existing = await prisma.test.findFirst({
      where: { courseId: course.id, testType: 'final', lessonId: null },
      select: { id: true },
    });
    if (existing) {
      res.status(400).json({ error: 'Бул курс үчүн курстук тест эле бар' });
      return;
    }

    const title = parsed.data.title?.trim() || `${course.title} — курстук тест`;
    const passingScore = parsed.data.passingScore ?? 80;

    const test = await prisma.$transaction(async (tx) => {
      const createdTest = await tx.test.create({
        data: {
          courseId: course.id,
          lessonId: null,
          title,
          testType: 'final',
          questionsCount: parsed.data.questions.length,
          passingScore,
          isActive: true,
        },
      });

      await createQuestionsForTest(tx, course.id, createdTest.id, parsed.data.questions);
      return createdTest;
    });

    const full = await getTestWithQuestions(test.id);
    res.status(201).json({ test: full ? serializeAdminTest(full) : null });
  }),
);

testsRouter.put(
  '/admin/tests/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = updateTestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    const existing = await prisma.test.findUnique({
      where: { id: req.params.id },
      include: {
        testQuestions: { select: { questionId: true } },
      },
    });
    if (!existing) {
      res.status(404).json({ error: 'Тест табылган жок' });
      return;
    }

    if (parsed.data.questions) {
      for (const question of parsed.data.questions) {
        const choiceError = validateChoiceQuestion(question);
        if (choiceError) {
          res.status(400).json({ error: choiceError });
          return;
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      if (parsed.data.questions) {
        const oldQuestionIds = existing.testQuestions.map((item) => item.questionId);
        await tx.testQuestion.deleteMany({ where: { testId: existing.id } });
        if (oldQuestionIds.length) {
          await tx.questionOption.deleteMany({ where: { questionId: { in: oldQuestionIds } } });
          await tx.question.deleteMany({ where: { id: { in: oldQuestionIds } } });
        }

        await createQuestionsForTest(tx, existing.courseId, existing.id, parsed.data.questions);
      }

      await tx.test.update({
        where: { id: existing.id },
        data: {
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.passingScore !== undefined
            ? { passingScore: parsed.data.passingScore }
            : {}),
          ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
          ...(parsed.data.questions ? { questionsCount: parsed.data.questions.length } : {}),
        },
      });
    });

    const full = await getTestWithQuestions(existing.id);
    res.json({ test: full ? serializeAdminTest(full) : null });
  }),
);

testsRouter.delete(
  '/admin/tests/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.test.findUnique({
      where: { id: req.params.id },
      include: { testQuestions: { select: { questionId: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: 'Тест табылган жок' });
      return;
    }

    const questionIds = existing.testQuestions.map((item) => item.questionId);

    await prisma.$transaction(async (tx) => {
      await tx.test.delete({ where: { id: existing.id } });
      if (questionIds.length) {
        await tx.questionOption.deleteMany({ where: { questionId: { in: questionIds } } });
        await tx.question.deleteMany({ where: { id: { in: questionIds } } });
      }
    });

    res.status(204).send();
  }),
);

testsRouter.get(
  '/courses/:courseRef/final-test',
  asyncHandler(async (req, res) => {
    const course = await resolveCourseRef(req.params.courseRef);
    if (!course || course.courseType !== 'paid') {
      res.status(404).json({ error: 'Тест табылган жок' });
      return;
    }

    const test = await findFinalTestForCourse(course.id, true);
    if (!test) {
      res.status(404).json({ error: 'Тест табылган жок' });
      return;
    }

    const questions = test.testQuestions
      .filter((item) => item.question?.isActive)
      .map((item) => toPublicQuestion(item.question));

    res.json({
      id: test.id,
      title: test.title,
      passingScore: Number(test.passingScore),
      questions,
    });
  }),
);

testsRouter.post(
  '/courses/:courseRef/final-test/grade',
  asyncHandler(async (req, res) => {
    const parsed = gradeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    const course = await resolveCourseRef(req.params.courseRef);
    if (!course) {
      res.status(404).json({ error: 'Курс табылган жок' });
      return;
    }

    const test = await findFinalTestForCourse(course.id, true);
    if (!test) {
      res.status(404).json({ error: 'Тест табылган жок' });
      return;
    }

    res.json(gradeTestAnswers(test, parsed.data.answers));
  }),
);
