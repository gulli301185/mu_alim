import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../lib/async-handler.js';
import { requireAdmin } from '../middleware/auth.js';
import { uniqueSlug } from '../lib/slug.js';
import { parseTelegramHtmlExport } from '../lib/telegram-html-parser.js';
import { importQaArticles } from '../lib/qa-import-service.js';
import { parseQuestionNumberSearch } from '../lib/qa-search.js';

export const qaRouter = Router();

const sortSchema = z.enum(['default', 'newest', 'oldest', 'popular']);

function toClient(article: {
  id: string;
  slug: string;
  questionNumber: number | null;
  question: string;
  answer: string;
  excerpt: string | null;
  tags: string[];
  type: 'text' | 'video';
  telegramViews: number;
  siteViews: number;
  views: number;
  publishedAt: Date;
}) {
  const excerpt =
    article.excerpt ??
    (article.answer.length > 160 ? `${article.answer.slice(0, 160).trim()}…` : article.answer);

  return {
    id: article.slug,
    recordId: article.id,
    slug: article.slug,
    number: article.questionNumber,
    title: article.question,
    question: article.question,
    answer: article.answer,
    excerpt,
    tags: article.tags,
    views: (article.telegramViews ?? 0) + (article.siteViews ?? 0),
    publishedAt: article.publishedAt.toISOString(),
    type: article.type,
    source: 'telegram' as const,
  };
}

qaRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search ?? '').trim();
    const sort = sortSchema.safeParse(req.query.sort).success
      ? sortSchema.parse(req.query.sort)
      : 'default';

    const where: Prisma.QaArticleWhereInput = {
      isPublished: true,
      ...(search
        ? (() => {
            const or: Prisma.QaArticleWhereInput[] = [
              { question: { contains: search, mode: 'insensitive' as const } },
              { answer: { contains: search, mode: 'insensitive' as const } },
              { tags: { has: search.toLowerCase() } },
            ];

            const questionNumber = parseQuestionNumberSearch(search);
            if (questionNumber != null) {
              or.unshift({ questionNumber });
            }

            return { OR: or };
          })()
        : {}),
    };

    const orderBy: Prisma.QaArticleOrderByWithRelationInput[] =
      sort === 'newest'
        ? [{ publishedAt: 'desc' }, { questionNumber: { sort: 'asc', nulls: 'last' } }]
        : sort === 'oldest'
          ? [{ publishedAt: 'asc' }, { questionNumber: { sort: 'asc', nulls: 'last' } }]
          : sort === 'popular'
            ? [
                { views: 'desc' },
                { siteViews: 'desc' },
                { telegramViews: 'desc' },
                { questionNumber: { sort: 'asc', nulls: 'last' } },
              ]
            : [{ questionNumber: { sort: 'asc', nulls: 'last' } }, { publishedAt: 'desc' }];

    const [items, total] = await Promise.all([
      prisma.qaArticle.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.qaArticle.count({ where }),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({
      items: items.map((item) => toClient(item)),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      sort,
    });
  }),
);

qaRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const article = await prisma.qaArticle.findFirst({
      where: { slug: req.params.slug, isPublished: true },
    });

    if (!article) {
      res.status(404).json({ error: 'Суроо табылган жок' });
      return;
    }

    const client = toClient(article);
    if (client.number == null) {
      const rank = await prisma.qaArticle.count({
        where: {
          isPublished: true,
          OR: [
            { publishedAt: { lt: article.publishedAt } },
            {
              publishedAt: article.publishedAt,
              createdAt: { lt: article.createdAt },
            },
          ],
        },
      });
      client.number = rank + 1;
    }

    res.json(client);
  }),
);

qaRouter.post(
  '/:slug/view',
  asyncHandler(async (req, res) => {
    const article = await prisma.qaArticle.findFirst({
      where: { slug: req.params.slug, isPublished: true },
    });

    if (!article) {
      res.status(404).json({ error: 'Суроо табылган жок' });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.qaArticle.update({
        where: { id: article.id },
        data: { siteViews: { increment: 1 } },
      });

      return tx.qaArticle.update({
        where: { id: row.id },
        data: { views: row.telegramViews + row.siteViews },
      });
    });

    res.json({
      views: (updated.telegramViews ?? 0) + (updated.siteViews ?? 0),
    });
  }),
);

const qaBodySchema = z.object({
  question: z.string().min(3),
  answer: z.string().min(1),
  number: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['text', 'video']).optional(),
  isPublished: z.boolean().optional(),
  publishedAt: z.string().datetime().optional(),
});

qaRouter.post(
  '/',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = qaBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    const slug = await uniqueSlug(parsed.data.question, async (s) => {
      const found = await prisma.qaArticle.findUnique({ where: { slug: s } });
      return Boolean(found);
    });

    const article = await prisma.qaArticle.create({
      data: {
        slug,
        questionNumber: parsed.data.number,
        question: parsed.data.question,
        answer: parsed.data.answer,
        tags: parsed.data.tags ?? [],
        type: parsed.data.type ?? 'text',
        isPublished: parsed.data.isPublished ?? true,
        publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : new Date(),
        createdById: req.user?.id,
      },
    });

    res.status(201).json(toClient(article));
  }),
);

qaRouter.put(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const parsed = qaBodySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Маалымат туура эмес' });
      return;
    }

    const existing = await prisma.qaArticle.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Суроо табылган жок' });
      return;
    }

    const article = await prisma.qaArticle.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.question !== undefined ? { question: parsed.data.question } : {}),
        ...(parsed.data.number !== undefined ? { questionNumber: parsed.data.number } : {}),
        ...(parsed.data.answer !== undefined ? { answer: parsed.data.answer } : {}),
        ...(parsed.data.tags !== undefined ? { tags: parsed.data.tags } : {}),
        ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
        ...(parsed.data.isPublished !== undefined ? { isPublished: parsed.data.isPublished } : {}),
        ...(parsed.data.publishedAt !== undefined
          ? { publishedAt: new Date(parsed.data.publishedAt) }
          : {}),
      },
    });

    res.json(toClient(article));
  }),
);

qaRouter.delete(
  '/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.qaArticle.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Суроо табылган жок' });
      return;
    }

    await prisma.qaArticle.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

qaRouter.post(
  '/import/telegram-html',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const html = typeof req.body?.html === 'string' ? req.body.html : '';
    if (html.length < 100) {
      res.status(400).json({ error: 'Веб-барактын маалыматы керек' });
      return;
    }

    const items = parseTelegramHtmlExport(html);
    if (items.length === 0) {
      res.status(400).json({ error: 'Суроо-жооп табылган жок' });
      return;
    }

    const result = await importQaArticles(prisma, items);
    res.json({ message: 'Телеграм экспорту ийгиликтүү импорт кылынды', ...result });
  }),
);
