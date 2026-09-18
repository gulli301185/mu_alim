import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getNextQuestionNumber(db: DbClient = prisma): Promise<number> {
  const [qaMax, submissionMax] = await Promise.all([
    db.qaArticle.aggregate({ _max: { questionNumber: true } }),
    db.teacherQuestionSubmission.aggregate({ _max: { questionNumber: true } }),
  ]);

  const current = Math.max(
    qaMax._max.questionNumber ?? 0,
    submissionMax._max.questionNumber ?? 0,
  );

  return current + 1;
}
