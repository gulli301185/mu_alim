import { EntityManager, In, IsNull } from 'typeorm';
import type { DataSource } from 'typeorm';
import { connectScriptDb } from './database/data-source';
import { Course, Question, QuestionOption, Test, TestQuestion } from './database/entities';
import {
  buildGenericFinalTest,
  FINAL_TESTS_BY_SLUG,
  type SeedChoiceQuestion,
} from './data/final-tests-seed.js';

let ds: DataSource;

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

async function seedFinalTestForCourse(slug: string, title: string, courseId: string) {
  const tests = ds.getRepository(Test);
  const existing = await tests.findOne({
    where: { courseId, testType: 'final', lessonId: IsNull() },
    select: { id: true, questionsCount: true },
  });

  const seed = FINAL_TESTS_BY_SLUG[slug] ?? buildGenericFinalTest(title);

  if (existing) {
    if (existing.questionsCount === seed.questions.length) {
      console.log(`· ${title}: тест бар (${seed.questions.length} суроо)`);
      return;
    }

    const oldQuestions = await ds.getRepository(TestQuestion).find({
      where: { testId: existing.id },
      select: { questionId: true },
    });
    const oldQuestionIds = oldQuestions.map((item) => item.questionId);

    await ds.transaction(async (em) => {
      await em.delete(TestQuestion, { testId: existing.id });
      if (oldQuestionIds.length) {
        await em.delete(QuestionOption, { questionId: In(oldQuestionIds) });
        await em.delete(Question, { id: In(oldQuestionIds) });
      }
      await em.update(
        Test,
        { id: existing.id },
        {
          title: seed.title,
          passingScore: seed.passingScore,
          questionsCount: seed.questions.length,
          isActive: true,
          updatedAt: new Date(),
        },
      );
    });

    await ds.transaction((em) => createQuestionsForTest(em, courseId, existing.id, seed.questions));
    console.log(`✓ ${title}: тест жаңыртылды (${seed.questions.length} суроо)`);
    return;
  }

  const test = await tests.save(
    tests.create({
      courseId,
      lessonId: null,
      title: seed.title,
      testType: 'final',
      questionsCount: seed.questions.length,
      passingScore: seed.passingScore,
      maxAttempts: null,
      isActive: true,
    }),
  );

  await ds.transaction((em) => createQuestionsForTest(em, courseId, test.id, seed.questions));
  console.log(`✓ ${title}: тест түзүлдү (${seed.questions.length} суроо)`);
}

async function main() {
  ds = await connectScriptDb();
  const courses = await ds.getRepository(Course).find({
    where: { courseType: 'paid', isPublished: true },
    select: { id: true, slug: true, title: true },
    order: { title: 'ASC' },
  });

  if (!courses.length) {
    console.log('Жарыяланган акы төлөнүүчү курстар табылган жок. Алгач db:seed:courses иштетиңиз.');
    return;
  }

  for (const course of courses) {
    await seedFinalTestForCourse(course.slug, course.title, course.id);
  }

  const testCount = await ds.getRepository(Test).countBy({ testType: 'final' });
  console.log(`Final tests in DB: ${testCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await ds?.destroy();
  });
