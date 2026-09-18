import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  buildGenericFinalTest,
  FINAL_TESTS_BY_SLUG,
  type SeedChoiceQuestion,
} from './data/final-tests-seed.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const prisma = new PrismaClient();

async function createQuestionsForTest(
  courseId: string,
  testId: string,
  questions: SeedChoiceQuestion[],
) {
  for (const [index, questionInput] of questions.entries()) {
    const question = await prisma.question.create({
      data: {
        courseId,
        questionText: questionInput.questionText,
        questionType: 'choice',
        explanation: questionInput.explanation ?? null,
      },
    });

    await prisma.questionOption.createMany({
      data: questionInput.options.map((option) => ({
        questionId: question.id,
        optionText: option.optionText,
        isCorrect: option.isCorrect,
        optionOrder: option.optionOrder,
      })),
    });

    await prisma.testQuestion.create({
      data: {
        testId,
        questionId: question.id,
        questionOrder: index + 1,
      },
    });
  }
}

async function seedFinalTestForCourse(slug: string, title: string, courseId: string) {
  const existing = await prisma.test.findFirst({
    where: { courseId, testType: 'final', lessonId: null },
    select: { id: true, questionsCount: true },
  });

  const seed = FINAL_TESTS_BY_SLUG[slug] ?? buildGenericFinalTest(title);

  if (existing) {
    if (existing.questionsCount === seed.questions.length) {
      console.log(`· ${title}: тест бар (${seed.questions.length} суроо)`);
      return;
    }

    const oldQuestions = await prisma.testQuestion.findMany({
      where: { testId: existing.id },
      select: { questionId: true },
    });
    const oldQuestionIds = oldQuestions.map((item) => item.questionId);

    await prisma.$transaction(async (tx) => {
      await tx.testQuestion.deleteMany({ where: { testId: existing.id } });
      if (oldQuestionIds.length) {
        await tx.questionOption.deleteMany({ where: { questionId: { in: oldQuestionIds } } });
        await tx.question.deleteMany({ where: { id: { in: oldQuestionIds } } });
      }
      await tx.test.update({
        where: { id: existing.id },
        data: {
          title: seed.title,
          passingScore: seed.passingScore,
          questionsCount: seed.questions.length,
          isActive: true,
        },
      });
    });

    await createQuestionsForTest(courseId, existing.id, seed.questions);
    console.log(`✓ ${title}: тест жаңыртылды (${seed.questions.length} суроо)`);
    return;
  }

  const test = await prisma.test.create({
    data: {
      courseId,
      lessonId: null,
      title: seed.title,
      testType: 'final',
      questionsCount: seed.questions.length,
      passingScore: seed.passingScore,
      isActive: true,
    },
  });

  await createQuestionsForTest(courseId, test.id, seed.questions);
  console.log(`✓ ${title}: тест түзүлдү (${seed.questions.length} суроо)`);
}

async function main() {
  const courses = await prisma.course.findMany({
    where: { courseType: 'paid', isPublished: true },
    select: { id: true, slug: true, title: true },
    orderBy: { title: 'asc' },
  });

  if (!courses.length) {
    console.log('Жарыяланган акы төлөнүүчү курстар табылган жок. Алгач db:seed:courses иштетиңиз.');
    return;
  }

  for (const course of courses) {
    await seedFinalTestForCourse(course.slug, course.title, course.id);
  }

  const testCount = await prisma.test.count({ where: { testType: 'final' } });
  console.log(`Final tests in DB: ${testCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
