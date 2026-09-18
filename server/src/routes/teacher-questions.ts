import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { getNextQuestionNumber } from '../lib/next-question-number.js';
import { publishTeacherQuestionSubmission } from '../lib/publish-teacher-question.js';
import { requireAdmin } from '../middleware/auth.js';

export const teacherQuestionsRouter = Router();

const submitSchema = z.object({
  name: z.string().trim().min(2, 'Аты-жөнү керек').max(200),
  question: z.string().trim().min(10, 'Суроо кыска').max(4000),
});

const adminListQuerySchema = z.object({
  status: z.enum(['pending', 'answered', 'all']).default('pending'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
});

const publishSchema = z.object({
  answer: z.string().trim().min(1, 'Жооп керек').max(20000),
});

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

teacherQuestionsRouter.get(
  '/teacher-questions/next-number',
  asyncHandler(async (_req, res) => {
    const nextNumber = await getNextQuestionNumber();
    res.json({ nextNumber });
  }),
);

teacherQuestionsRouter.post(
  '/teacher-questions',
  asyncHandler(async (req, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Маалымат туура эмес';
      res.status(400).json({ error: message });
      return;
    }

    const row = await prisma.$transaction(async (tx) => {
      const questionNumber = await getNextQuestionNumber(tx);
      return tx.teacherQuestionSubmission.create({
        data: {
          ...parsed.data,
          questionNumber,
        },
      });
    });

    res.status(201).json({
      id: row.id,
      questionNumber: row.questionNumber,
      message: `${row.questionNumber}-суроо жөнөтүлдү. Жакынкы арада жооп беребиз.`,
    });
  }),
);

teacherQuestionsRouter.get(
  '/admin/teacher-questions',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = adminListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Сурам туура эмес' });
      return;
    }

    const { status, page, limit, q } = parsed.data;

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

    const combinedWhere: Prisma.TeacherQuestionSubmissionWhereInput = {
      AND: [statusWhere, ...(q ? [searchWhere] : [])],
    };

    const [rows, total] = await Promise.all([
      prisma.teacherQuestionSubmission.findMany({
        where: combinedWhere,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { qaArticle: { select: { slug: true } } },
      }),
      prisma.teacherQuestionSubmission.count({ where: combinedWhere }),
    ]);

    res.json({
      items: rows.map((row) => toAdminItem(row)),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

teacherQuestionsRouter.post(
  '/admin/teacher-questions/:id/publish',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = publishSchema.safeParse(req.body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Маалымат туура эмес';
      res.status(400).json({ error: message });
      return;
    }

    const submissionId = String(req.params.id);

    try {
      const result = await prisma.$transaction(async (tx) =>
        publishTeacherQuestionSubmission(
          submissionId,
          parsed.data.answer,
          req.user?.id,
          tx,
        ),
      );

      res.status(201).json({
        slug: result.article.slug,
        questionNumber: result.article.questionNumber,
        message:
          result.article.questionNumber != null
            ? `${result.article.questionNumber}-суроо жарияланды`
            : 'Суроо-жооп жарияланды',
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        res.status(404).json({ error: 'Суроо табылган жок' });
        return;
      }
      if (err instanceof Error && err.message === 'ALREADY_PUBLISHED') {
        res.status(409).json({ error: 'Бул суроо мурунтан жарияланган' });
        return;
      }
      throw err;
    }
  }),
);
