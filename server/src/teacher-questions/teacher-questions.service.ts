import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueSlug } from '../lib/slug';

export const submitSchema = z.object({
  name: z.string().trim().min(2, 'Аты-жөнү керек').max(200),
  question: z.string().trim().min(10, 'Суроо кыска').max(4000),
});

export const adminListQuerySchema = z.object({
  status: z.enum(['pending', 'answered', 'all']).default('pending'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});

export const publishSchema = z.object({
  answer: z.string().trim().min(1, 'Жооп керек').max(20000),
});

type Db = Prisma.TransactionClient | PrismaService;

function toAdminItem(row: {
  id: string;
  questionNumber: number | null;
  name: string;
  question: string;
  answer: string | null;
  createdAt: Date;
  answeredAt: Date | null;
  qaArticle: { slug: string } | null;
}) {
  return {
    id: row.id,
    questionNumber: row.questionNumber,
    name: row.name,
    question: row.question,
    answer: row.answer,
    createdAt: row.createdAt.toISOString(),
    answeredAt: row.answeredAt?.toISOString() ?? null,
    qaSlug: row.qaArticle?.slug ?? null,
    status: row.qaArticle ? ('answered' as const) : ('pending' as const),
  };
}

@Injectable()
export class TeacherQuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getNextQuestionNumber(db: Db = this.prisma): Promise<number> {
    const [qaMax, submissionMax] = await Promise.all([
      db.qaArticle.aggregate({ _max: { questionNumber: true } }),
      db.teacherQuestionSubmission.aggregate({ _max: { questionNumber: true } }),
    ]);

    const current = Math.max(qaMax._max.questionNumber ?? 0, submissionMax._max.questionNumber ?? 0);
    return current + 1;
  }

  async nextNumber() {
    return { nextNumber: await this.getNextQuestionNumber() };
  }

  async submit(data: z.infer<typeof submitSchema>) {
    const row = await this.prisma.$transaction(async (tx) => {
      const questionNumber = await this.getNextQuestionNumber(tx);
      return tx.teacherQuestionSubmission.create({ data: { ...data, questionNumber } });
    });

    return {
      id: row.id,
      questionNumber: row.questionNumber,
      message: `${row.questionNumber}-суроо жөнөтүлдү. Жакынкы арада жооп беребиз.`,
    };
  }

  async adminList({ status, page, limit, q }: z.infer<typeof adminListQuerySchema>) {
    const statusWhere: Prisma.TeacherQuestionSubmissionWhereInput =
      status === 'pending'
        ? { qaArticleId: null }
        : status === 'answered'
          ? { qaArticleId: { not: null } }
          : {};

    const searchWhere: Prisma.TeacherQuestionSubmissionWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { question: { contains: q, mode: 'insensitive' } },
            ...(Number.isFinite(Number(q)) ? [{ questionNumber: Number(q) }] : []),
          ],
        }
      : {};

    const where: Prisma.TeacherQuestionSubmissionWhereInput = {
      AND: [statusWhere, ...(q ? [searchWhere] : [])],
    };

    const [rows, total] = await Promise.all([
      this.prisma.teacherQuestionSubmission.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { qaArticle: { select: { slug: true } } },
      }),
      this.prisma.teacherQuestionSubmission.count({ where }),
    ]);

    return {
      items: rows.map(toAdminItem),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  private async publishSubmission(db: Db, submissionId: string, answer: string, createdById?: string) {
    const submission = await db.teacherQuestionSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new AppError(404, 'Суроо табылган жок');
    if (submission.qaArticleId) throw new AppError(409, 'Бул суроо мурунтан жарияланган');

    const slugBase =
      submission.questionNumber != null ? `${submission.questionNumber}-suroo` : submission.question;

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
      data: { answer, qaArticleId: article.id, answeredAt: new Date() },
    });

    return article;
  }

  async publish(id: string, answer: string, adminId?: string) {
    const article = await this.prisma.$transaction((tx) => this.publishSubmission(tx, id, answer, adminId));
    await this.cache.invalidate('qa:');

    return {
      slug: article.slug,
      questionNumber: article.questionNumber,
      message:
        article.questionNumber != null
          ? `${article.questionNumber}-суроо жарияланды`
          : 'Суроо-жооп жарияланды',
    };
  }
}

