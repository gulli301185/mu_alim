import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { AppError } from '../common/app-error';
import { AuthUser } from '../common/auth';
import { CoursesService } from '../courses/courses.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CHOICE_LABELS,
  FINAL_TEST_FAIL_LIMIT,
  FINAL_TEST_LOCK_MS,
  TestLockState,
  gradeTestAnswers,
  toPublicQuestion,
  validateChoiceQuestion,
} from './tests.helpers';
import type { GradeAnswers, QuestionInput, createTestSchema, updateTestSchema } from './tests.schemas';

const TEST_NOT_FOUND = 'Тест табылган жок';

const questionsInclude = {
  testQuestions: {
    orderBy: { questionOrder: 'asc' },
    include: {
      question: {
        include: { options: { orderBy: { optionOrder: 'asc' } } },
      },
    },
  },
} satisfies Prisma.TestInclude;

type FullTest = NonNullable<Awaited<ReturnType<TestsService['getTestWithQuestions']>>>;

@Injectable()
export class TestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly courses: CoursesService,
  ) {}

  private getTestWithQuestions(testId: string) {
    return this.prisma.test.findUnique({
      where: { id: testId },
      include: {
        course: { select: { id: true, title: true, slug: true, courseType: true } },
        lesson: { select: { id: true, title: true, lessonOrder: true } },
        ...questionsInclude,
      },
    });
  }

  private serializeAdminTest(test: FullTest) {
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

  private findFinalTestForCourse(courseId: string, activeOnly = false) {
    return this.prisma.test.findFirst({
      where: {
        courseId,
        testType: 'final',
        lessonId: null,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: questionsInclude,
    });
  }

  private async getFinalTestLockState(userId: string, testId: string): Promise<TestLockState> {
    const attempts = await this.prisma.testAttempt.findMany({
      where: { userId, testId, completedAt: { not: null } },
      orderBy: { completedAt: 'asc' },
      select: { passed: true, completedAt: true },
    });

    let lastPassIndex = -1;
    for (let i = 0; i < attempts.length; i += 1) {
      if (attempts[i].passed) lastPassIndex = i;
    }
    const fails = attempts.slice(lastPassIndex + 1).filter((item) => !item.passed);
    const now = Date.now();

    let index = 0;
    while (index + FINAL_TEST_FAIL_LIMIT <= fails.length) {
      const third = fails[index + FINAL_TEST_FAIL_LIMIT - 1];
      const lockedUntil = new Date((third.completedAt ?? new Date()).getTime() + FINAL_TEST_LOCK_MS);
      if (now < lockedUntil.getTime()) {
        return {
          locked: true,
          lockedUntil: lockedUntil.toISOString(),
          remainingAttempts: 0,
          failedInWindow: FINAL_TEST_FAIL_LIMIT,
        };
      }
      index += FINAL_TEST_FAIL_LIMIT;
    }

    const leftover = fails.length - index;
    return {
      locked: false,
      lockedUntil: null,
      remainingAttempts: FINAL_TEST_FAIL_LIMIT - leftover,
      failedInWindow: leftover,
    };
  }

  private async createQuestionsForTest(
    tx: Prisma.TransactionClient,
    courseId: string,
    testId: string,
    questions: QuestionInput[],
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
        data: { testId, questionId: question.id, questionOrder: index + 1 },
      });
    }
  }

  private assertChoiceQuestions(questions: QuestionInput[]) {
    for (const question of questions) {
      const choiceError = validateChoiceQuestion(question);
      if (choiceError) throw new AppError(400, choiceError);
    }
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async adminList(courseRef?: string) {
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

    const tests = await this.prisma.test.findMany({
      where,
      orderBy: [{ course: { title: 'asc' } }],
      include: {
        course: { select: { id: true, title: true, slug: true, courseType: true } },
        lesson: { select: { id: true, title: true, lessonOrder: true } },
      },
    });

    return {
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
    };
  }

  async adminGet(id: string) {
    const test = await this.getTestWithQuestions(id);
    if (!test) throw new AppError(404, TEST_NOT_FOUND);
    return { test: this.serializeAdminTest(test) };
  }

  async adminCreate(data: z.infer<typeof createTestSchema>) {
    this.assertChoiceQuestions(data.questions);

    const course = await this.courses.resolveRef(data.courseRef);
    if (!course) throw new AppError(404, 'Курс табылган жок');

    const existing = await this.prisma.test.findFirst({
      where: { courseId: course.id, testType: 'final', lessonId: null },
      select: { id: true },
    });
    if (existing) throw new AppError(400, 'Бул курс үчүн курстук тест эле бар');

    const title = data.title?.trim() || `${course.title} — курстук тест`;
    const passingScore = data.passingScore ?? 90;

    const test = await this.prisma.$transaction(async (tx) => {
      const createdTest = await tx.test.create({
        data: {
          courseId: course.id,
          lessonId: null,
          title,
          testType: 'final',
          questionsCount: data.questions.length,
          passingScore,
          isActive: true,
        },
      });

      await this.createQuestionsForTest(tx, course.id, createdTest.id, data.questions);
      return createdTest;
    });

    const full = await this.getTestWithQuestions(test.id);
    return { test: full ? this.serializeAdminTest(full) : null };
  }

  async adminUpdate(id: string, data: z.infer<typeof updateTestSchema>) {
    const existing = await this.prisma.test.findUnique({
      where: { id },
      include: { testQuestions: { select: { questionId: true } } },
    });
    if (!existing) throw new AppError(404, TEST_NOT_FOUND);

    if (data.questions) this.assertChoiceQuestions(data.questions);

    await this.prisma.$transaction(async (tx) => {
      if (data.questions) {
        const oldQuestionIds = existing.testQuestions.map((item) => item.questionId);
        await tx.testQuestion.deleteMany({ where: { testId: existing.id } });
        if (oldQuestionIds.length) {
          await tx.questionOption.deleteMany({ where: { questionId: { in: oldQuestionIds } } });
          await tx.question.deleteMany({ where: { id: { in: oldQuestionIds } } });
        }

        await this.createQuestionsForTest(tx, existing.courseId, existing.id, data.questions);
      }

      await tx.test.update({
        where: { id: existing.id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.passingScore !== undefined ? { passingScore: data.passingScore } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.questions ? { questionsCount: data.questions.length } : {}),
        },
      });
    });

    const full = await this.getTestWithQuestions(existing.id);
    return { test: full ? this.serializeAdminTest(full) : null };
  }

  async adminDelete(id: string) {
    const existing = await this.prisma.test.findUnique({
      where: { id },
      include: { testQuestions: { select: { questionId: true } } },
    });
    if (!existing) throw new AppError(404, TEST_NOT_FOUND);

    const questionIds = existing.testQuestions.map((item) => item.questionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.test.delete({ where: { id: existing.id } });
      if (questionIds.length) {
        await tx.questionOption.deleteMany({ where: { questionId: { in: questionIds } } });
        await tx.question.deleteMany({ where: { id: { in: questionIds } } });
      }
    });
  }

  // ─── Learner ───────────────────────────────────────────────────────────────

  async getFinalTest(ref: string, user: AuthUser | undefined) {
    const course = await this.courses.resolveRef(ref);
    if (!course) throw new AppError(404, TEST_NOT_FOUND);

    const test = await this.findFinalTestForCourse(course.id, true);
    if (!test) throw new AppError(404, TEST_NOT_FOUND);

    const questions = test.testQuestions
      .filter((item) => item.question?.isActive)
      .map((item) => toPublicQuestion(item.question));

    const lock: TestLockState =
      user?.role === 'user'
        ? await this.getFinalTestLockState(user.id, test.id)
        : {
            locked: false,
            lockedUntil: null,
            remainingAttempts: FINAL_TEST_FAIL_LIMIT,
            failedInWindow: 0,
          };

    return {
      id: test.id,
      title: test.title,
      passingScore: Number(test.passingScore),
      questions,
      ...lock,
    };
  }

  async gradeFinalTest(ref: string, user: AuthUser, answers: GradeAnswers) {
    const course = await this.courses.resolveRef(ref);
    if (!course) throw new AppError(404, 'Курс табылган жок');

    const test = await this.findFinalTestForCourse(course.id, true);
    if (!test) throw new AppError(404, TEST_NOT_FOUND);

    const lock = await this.getFinalTestLockState(user.id, test.id);
    if (lock.locked) {
      throw new AppError(423, 'Тесттен 3 жолу өтпөдүңүз. Даярданып, кайрадан тест тапшырыңыз.', {
        ...lock,
      });
    }

    const result = gradeTestAnswers(test, answers);
    const now = new Date();
    const previousCount = await this.prisma.testAttempt.count({
      where: { userId: user.id, testId: test.id },
    });

    await this.prisma.testAttempt.create({
      data: {
        userId: user.id,
        testId: test.id,
        attemptNumber: previousCount + 1,
        totalQuestions: result.total,
        correctAnswers: result.correct,
        score: result.scorePercent,
        passed: result.passed,
        startedAt: now,
        completedAt: now,
      },
    });

    const nextLock = await this.getFinalTestLockState(user.id, test.id);
    return { ...result, ...nextLock };
  }
}
