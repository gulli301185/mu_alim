import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/auth.js';
import { uniqueSlug } from '../lib/slug.js';

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
  views: number;
  publishedAt: Date;
}) {
  const excerpt =
    article.excerpt ??
    (article.answer.length > 160 ? `${article.answer.slice(0, 160).trim()}…` : article.answer);

  return {
    id: article.slug,
    slug: article.slug,
    number: article.questionNumber,
    title: article.question,
    question: article.question,
    answer: article.answer,
    excerpt,
    tags: article.tags,
    views: article.views,
    publishedAt: article.publishedAt.toISOString(),
    type: article.type,
    source: 'telegram' as const,
  };
}

qaRouter.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const search = String(req.query.search ?? '').trim();
  const sort = sortSchema.safeParse(req.query.sort).success
    ? sortSchema.parse(req.query.sort)
    : 'default';

  const where: Prisma.QaArticleWhereInput = {
    isPublished: true,
    ...(search
      ? {
          OR: [
            { question: { contains: search, mode: 'insensitive' as const } },
            { answer: { contains: search, mode: 'insensitive' as const } },
            { tags: { has: search.toLowerCase() } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.QaArticleOrderByWithRelationInput[] =
    sort === 'newest'
      ? [{ publishedAt: 'desc' }]
      : sort === 'oldest'
        ? [{ publishedAt: 'asc' }]
        : sort === 'popular'
          ? [{ views: 'desc' }]
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

  res.json({
    items: items.map((item, index) => {
      const client = toClient(item);
      if (sort === 'default') {
        client.number = (page - 1) * limit + index + 1;
      }
      return client;
    }),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

qaRouter.get('/:slug', async (req, res) => {
  const article = await prisma.qaArticle.findFirst({
    where: { slug: req.params.slug, isPublished: true },
  });

  if (!article) {
    res.status(404).json({ error: 'Суроо табылган жок' });
    return;
  }

  const updated = await prisma.qaArticle.update({
    where: { id: article.id },
    data: { views: { increment: 1 } },
  });

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

  const client = toClient(updated);
  client.number = rank + 1;
  res.json(client);
});

const qaBodySchema = z.object({
  question: z.string().min(3),
  answer: z.string().min(1),
  number: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['text', 'video']).optional(),
  isPublished: z.boolean().optional(),
  publishedAt: z.string().datetime().optional(),
});

qaRouter.post('/', requireAdmin, async (req, res) => {
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
});

qaRouter.put('/:id', requireAdmin, async (req, res) => {
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
});

qaRouter.delete('/:id', requireAdmin, async (req, res) => {
  const existing = await prisma.qaArticle.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Суроо табылган жок' });
    return;
  }

  await prisma.qaArticle.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
