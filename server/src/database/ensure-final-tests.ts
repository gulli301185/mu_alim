import { Logger } from '@nestjs/common';
import { IsNull } from 'typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import {
  buildGenericFinalTest,
  FINAL_TESTS_BY_SLUG,
  type SeedChoiceQuestion,
} from '../data/final-tests-seed';
import { Course, Question, QuestionOption, Test, TestQuestion } from './entities';

async function createQuestionsForTest(
  em: EntityManager,
  courseId: string,
  testId: string,
  questions: SeedChoiceQuestion[],
) {
  for (const [index, questionInput] of questions.entries()) {
    const question = await em.save(
      em.create(Question, {
        courseId,
        questionText: questionInput.questionText,
        questionType: 'choice',
        correctTextAnswer: null,
        explanation: questionInput.explanation ?? null,
        isActive: true,
      }),
    );

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

    await em.save(em.create(TestQuestion, { testId, questionId: question.id, questionOrder: index + 1 }));
  }
}

/**
 * Creates an active final test for each published paid course that does not have one yet.
 */
export async function ensureFinalTests(ds: DataSource): Promise<boolean> {
  const logger = new Logger('Database');
  const courses = await ds.getRepository(Course).find({
    where: { courseType: 'paid', isPublished: true },
    select: { id: true, slug: true, title: true },
  });
  if (!courses.length) return false;

  const tests = ds.getRepository(Test);
  let created = 0;

  for (const course of courses) {
    const existing = await tests.findOne({
      where: { courseId: course.id, testType: 'final', lessonId: IsNull(), isActive: true },
      select: { id: true },
    });
    if (existing) continue;

    const seed = FINAL_TESTS_BY_SLUG[course.slug] ?? buildGenericFinalTest(course.title);
    const test = await tests.save(
      tests.create({
        courseId: course.id,
        lessonId: null,
        title: seed.title,
        testType: 'final',
        questionsCount: seed.questions.length,
        passingScore: seed.passingScore,
        maxAttempts: null,
        isActive: true,
      }),
    );
    await ds.transaction((em) => createQuestionsForTest(em, course.id, test.id, seed.questions));
    created += 1;
  }

  if (created === 0) return false;
  logger.log(`Loaded ${created} course final tests`);
  return true;
}
