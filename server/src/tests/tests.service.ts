import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import type { z } from 'zod';
import { AppError } from '../common/app-error';
import { AuthUser } from '../common/auth';
import { CoursesService } from '../courses/courses.service';
import { UUID_RE } from '../common/uuid';
import {
  Question,
  QuestionOption,
  Test,
  TestAttempt,
  TestQuestion,
} from '../database/entities';
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

const graphRelations = { testQuestions: { question: { options: true } } } as const;

const courseSummary = (course: { id: string; title: string; slug: string; courseType: string }) => ({
  id: course.id,
  title: course.title,
  slug: course.slug,
  courseType: course.courseType,
});

const lessonSummary = (lesson: { id: string; title: string; lessonOrder: number } | null) =>
  lesson ? { id: lesson.id, title: lesson.title, lessonOrder: lesson.lessonOrder } : null;

/** Orders questions and their options the way the API exposes them. */
function sortGraph<T extends Test>(test: T | null): T | null {
  if (!test) return test;
  test.testQuestions = [...(test.testQuestions ?? [])].sort(
    (a, b) => (a.questionOrder ?? 0) - (b.questionOrder ?? 0),
  );
  for (const item of test.testQuestions) {
    item.question.options = [...(item.question.options ?? [])].sort(
      (a, b) => a.optionOrder - b.optionOrder,
    );
  }
  return test;
}

type FullTest = NonNullable<Awaited<ReturnType<TestsService['getTestWithQuestions']>>>;

@Injectable()
export class TestsService {
  constructor(
    @InjectRepository(Test) private readonly testRepo: Repository<Test>,
    @InjectRepository(TestAttempt) private readonly attempts: Repository<TestAttempt>,
    private readonly ds: DataSource,
    private readonly courses: CoursesService,
  ) {}

  private async getTestWithQuestions(testId: string) {
    return sortGraph(
      await this.testRepo.findOne({
        where: { id: testId },
        relations: { course: true, lesson: true, ...graphRelations },
      }),
    );
  }

  private serializeAdminTest(test: FullTest) {
    return {
      id: test.id,
      title: test.title,
      testType: test.testType,
      passingScore: Number(test.passingScore),
      questionsCount: test.questionsCount,
      isActive: test.isActive,
      course: courseSummary(test.course),
      lesson: lessonSummary(test.lesson),
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

  private async findFinalTestForCourse(courseId: string, activeOnly = false) {
    return sortGraph(
      await this.testRepo.findOne({
        where: {
          courseId,
          testType: 'final',
          lessonId: IsNull(),
          ...(activeOnly ? { isActive: true } : {}),
        },
        relations: graphRelations,
      }),
    );
  }

  private async getFinalTestLockState(userId: string, testId: string): Promise<TestLockState> {
    const attempts = await this.attempts.find({
      where: { userId, testId, completedAt: Not(IsNull()) },
      order: { completedAt: 'ASC' },
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
    em: EntityManager,
    courseId: string,
    testId: string,
    questions: QuestionInput[],
  ) {
    for (const [index, questionInput] of questions.entries()) {
      const question = await em.save(
        em.create(Question, {
          courseId,
          questionText: questionInput.questionText,
          questionType: questionInput.questionType,
          correctTextAnswer:
            questionInput.questionType === 'text' ? questionInput.correctTextAnswer : null,
          explanation: questionInput.explanation ?? null,
          isActive: true,
        }),
      );

      if (questionInput.questionType === 'choice') {
        await em.save(
          questionInput.options.map((option) =>
            em.create(QuestionOption, {
              questionId: question.id,
              optionText: option.optionText,
              isCorrect: option.isCorrect,
              optionOrder: option.optionOrder,
            }),
          ),
        );
      }

      await em.save(
        em.create(TestQuestion, { testId, questionId: question.id, questionOrder: index + 1 }),
      );
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
    const qb = this.testRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.course', 'c')
      .leftJoinAndSelect('t.lesson', 'l')
      .where("t.testType = 'final'")
      .andWhere("c.courseType = 'paid'")
      .orderBy('c.title', 'ASC');

    if (courseRef) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('c.slug = :courseRef', { courseRef });
          if (UUID_RE.test(courseRef)) w.orWhere('c.id = :courseRef', { courseRef });
        }),
      );
    }

    const tests = await qb.getMany();

    return {
      items: tests.map((test) => ({
        id: test.id,
        title: test.title,
        testType: test.testType,
        passingScore: Number(test.passingScore),
        questionsCount: test.questionsCount,
        isActive: test.isActive,
        course: courseSummary(test.course),
        lesson: lessonSummary(test.lesson),
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

    const existing = await this.testRepo.findOne({
      where: { courseId: course.id, testType: 'final', lessonId: IsNull() },
      select: { id: true },
    });
    if (existing) throw new AppError(400, 'Бул курс үчүн курстук тест эле бар');

    const title = data.title?.trim() || `${course.title} — курстук тест`;
    const passingScore = data.passingScore ?? 90;

    const test = await this.ds.transaction(async (em) => {
      const createdTest = await em.save(
        em.create(Test, {
          courseId: course.id,
          lessonId: null,
          title,
          testType: 'final',
          questionsCount: data.questions.length,
          passingScore,
          maxAttempts: null,
          isActive: true,
        }),
      );

      await this.createQuestionsForTest(em, course.id, createdTest.id, data.questions);
      return createdTest;
    });

    const full = await this.getTestWithQuestions(test.id);
    return { test: full ? this.serializeAdminTest(full) : null };
  }

  async adminUpdate(id: string, data: z.infer<typeof updateTestSchema>) {
    const existing = await this.testRepo.findOne({ where: { id }, relations: { testQuestions: true } });
    if (!existing) throw new AppError(404, TEST_NOT_FOUND);

    if (data.questions) this.assertChoiceQuestions(data.questions);

    await this.ds.transaction(async (em) => {
      if (data.questions) {
        const oldQuestionIds = existing.testQuestions.map((item) => item.questionId);
        await em.delete(TestQuestion, { testId: existing.id });
        if (oldQuestionIds.length) {
          await em.delete(QuestionOption, { questionId: In(oldQuestionIds) });
          await em.delete(Question, { id: In(oldQuestionIds) });
        }

        await this.createQuestionsForTest(em, existing.courseId, existing.id, data.questions);
      }

      await em.update(
        Test,
        { id: existing.id },
        {
          updatedAt: new Date(),
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.passingScore !== undefined ? { passingScore: data.passingScore } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.questions ? { questionsCount: data.questions.length } : {}),
        },
      );
    });

    const full = await this.getTestWithQuestions(existing.id);
    return { test: full ? this.serializeAdminTest(full) : null };
  }

  async adminDelete(id: string) {
    const existing = await this.testRepo.findOne({ where: { id }, relations: { testQuestions: true } });
    if (!existing) throw new AppError(404, TEST_NOT_FOUND);

    const questionIds = existing.testQuestions.map((item) => item.questionId);

    await this.ds.transaction(async (em) => {
      await em.delete(Test, { id: existing.id });
      if (questionIds.length) {
        await em.delete(QuestionOption, { questionId: In(questionIds) });
        await em.delete(Question, { id: In(questionIds) });
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
    const previousCount = await this.attempts.countBy({ userId: user.id, testId: test.id });

    await this.attempts.save(
      this.attempts.create({
        userId: user.id,
        testId: test.id,
        attemptNumber: previousCount + 1,
        totalQuestions: result.total,
        correctAnswers: result.correct,
        score: result.scorePercent,
        passed: result.passed,
        startedAt: now,
        completedAt: now,
      }),
    );

    const nextLock = await this.getFinalTestLockState(user.id, test.id);
    return { ...result, ...nextLock };
  }
}
