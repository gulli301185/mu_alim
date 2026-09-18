import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { uniqueSlug } from './slug.js';

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function publishTeacherQuestionSubmission(
  submissionId: string,
  answer: string,
  createdById?: string,
  db: DbClient = prisma,
) {
  const submission = await db.teacherQuestionSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new Error('NOT_FOUND');
  }

  if (submission.qaArticleId) {
    throw new Error('ALREADY_PUBLISHED');
  }

  const slugBase =
    submission.questionNumber != null
      ? `${submission.questionNumber}-suroo`
      : submission.question;

  const slug = await uniqueSlug(slugBase, async (candidate) => {
    const found = await db.qaArticle.findUnique({ where: { slug: candidate } });
    return Boolean(found);
  });

  const article = await db.qaArticle.create({
    data: {
      slug,
      questionNumber: submission.questionNumber,
      question: submission.question,
      answer,
      isPublished: true,
      publishedAt: new Date(),
      createdById,
    },
  });

  await db.teacherQuestionSubmission.update({
    where: { id: submission.id },
    data: {
      answer,
      qaArticleId: article.id,
      answeredAt: new Date(),
    },
  });

  return { article, submissionId: submission.id };
}
