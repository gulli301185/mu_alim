import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { importQaArticles } from '../lib/qa-import-service';
import { parseQuestionNumberSearch } from '../lib/qa-search';
import { uniqueSlug } from '../lib/slug';
import { parseTelegramHtmlExport } from '../lib/telegram-html-parser';

const NOT_FOUND = 'Суроо табылган жок';
const LIST_TTL = 60;
const ARTICLE_TTL = 300;
const DAILY_START_DATE = '2026-08-22';

export const sortSchema = z.enum(['default', 'newest', 'oldest', 'popular']);

export const qaBodySchema = z.object({
  question: z.string().min(3),
  answer: z.string().min(1),
  number: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  type: z.enum(['text', 'video']).optional(),
  isPublished: z.boolean().optional(),
  publishedAt: z.string().datetime().optional(),
});

type ClientArticle = ReturnType<typeof toClient>;

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
    number: article.questionNumber as number | null,
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

function bishkekDateKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bishkek',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function dateKeyToUtcDays(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function dailySkip(dateKey: string, total: number) {
  const elapsed = dateKeyToUtcDays(dateKey) - dateKeyToUtcDays(DAILY_START_DATE);
  const dayOffset = elapsed < 0 ? 0 : elapsed;
  return dayOffset % total;
}

function orderFor(sort: z.infer<typeof sortSchema>): Prisma.QaArticleOrderByWithRelationInput[] {
  switch (sort) {
    case 'newest':
      return [{ publishedAt: 'desc' }, { questionNumber: { sort: 'asc', nulls: 'last' } }];
    case 'oldest':
      return [{ publishedAt: 'asc' }, { questionNumber: { sort: 'asc', nulls: 'last' } }];
    case 'popular':
      return [
        { views: 'desc' },
        { siteViews: 'desc' },
        { telegramViews: 'desc' },
        { questionNumber: { sort: 'asc', nulls: 'last' } },
      ];
    default:
      return [{ questionNumber: { sort: 'asc', nulls: 'last' } }, { publishedAt: 'desc' }];
  }
}

@Injectable()
export class QaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private invalidate() {
    return this.cache.invalidate('qa:');
  }

  list(query: { page?: unknown; limit?: unknown; search?: unknown; sort?: unknown }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const search = String(query.search ?? '').trim();
    const sortParsed = sortSchema.safeParse(query.sort);
    const sort = sortParsed.success ? sortParsed.data : 'default';

    return this.cache.wrap(
      `qa:list:${sort}:${page}:${limit}:${encodeURIComponent(search.toLowerCase())}`,
      LIST_TTL,
      async () => {
        const where: Prisma.QaArticleWhereInput = { isPublished: true };
        if (search) {
          const or: Prisma.QaArticleWhereInput[] = [
            { question: { contains: search, mode: 'insensitive' } },
            { answer: { contains: search, mode: 'insensitive' } },
            { tags: { has: search.toLowerCase() } },
          ];
          const questionNumber = parseQuestionNumberSearch(search);
          if (questionNumber != null) or.unshift({ questionNumber });
          where.OR = or;
        }

        const [items, total] = await Promise.all([
          this.prisma.qaArticle.findMany({
            where,
            orderBy: orderFor(sort),
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.prisma.qaArticle.count({ where }),
        ]);

        return {
          items: items.map(toClient),
          total,
          page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          sort,
        };
      },
    );
  }

  async daily() {
    const date = bishkekDateKey();
    const result = await this.cache.wrap<(ClientArticle & { date: string }) | null>(
      `qa:daily:${date}`,
      ARTICLE_TTL,
      async () => {
        const where: Prisma.QaArticleWhereInput = { isPublished: true };
        const total = await this.prisma.qaArticle.count({ where });
        if (total === 0) return null;

        const article = await this.prisma.qaArticle.findFirst({
          where,
          orderBy: [{ questionNumber: { sort: 'asc', nulls: 'last' } }, { publishedAt: 'asc' }],
          skip: dailySkip(date, total),
        });
        return article ? { ...toClient(article), date } : null;
      },
    );

    if (!result) throw new AppError(404, NOT_FOUND);
    return result;
  }

  async importTelegramHtml(html: unknown) {
    const text = typeof html === 'string' ? html : '';
    if (text.length < 100) throw new AppError(400, 'Веб-барактын маалыматы керек');

    const items = parseTelegramHtmlExport(text);
    if (items.length === 0) throw new AppError(400, 'Суроо-жооп табылган жок');

    const result = await importQaArticles(this.prisma, items);
    await this.invalidate();
    return { message: 'Телеграм экспорту ийгиликтүү импорт кылынды', ...result };
  }

  async getBySlug(slug: string) {
    const result = await this.cache.wrap<ClientArticle | null>(`qa:article:${slug}`, ARTICLE_TTL, async () => {
      const article = await this.prisma.qaArticle.findFirst({ where: { slug, isPublished: true } });
      if (!article) return null;

      const client = toClient(article);
      if (client.number == null) {
        const rank = await this.prisma.qaArticle.count({
          where: {
            isPublished: true,
            OR: [
              { publishedAt: { lt: article.publishedAt } },
              { publishedAt: article.publishedAt, createdAt: { lt: article.createdAt } },
            ],
          },
        });
        client.number = rank + 1;
      }
      return client;
    });

    if (!result) throw new AppError(404, NOT_FOUND);
    return result;
  }

  async registerView(slug: string) {
    const article = await this.prisma.qaArticle.findFirst({ where: { slug, isPublished: true } });
    if (!article) throw new AppError(404, NOT_FOUND);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.qaArticle.update({
        where: { id: article.id },
        data: { siteViews: { increment: 1 } },
      });

      return tx.qaArticle.update({
        where: { id: row.id },
        data: { views: row.telegramViews + row.siteViews },
      });
    });

    return { views: (updated.telegramViews ?? 0) + (updated.siteViews ?? 0) };
  }

  async create(data: z.infer<typeof qaBodySchema>, createdById?: string) {
    const slug = await uniqueSlug(data.question, async (s) => {
      const found = await this.prisma.qaArticle.findUnique({ where: { slug: s } });
      return Boolean(found);
    });

    const article = await this.prisma.qaArticle.create({
      data: {
        slug,
        questionNumber: data.number,
        question: data.question,
        answer: data.answer,
        tags: data.tags ?? [],
        type: data.type ?? 'text',
        isPublished: data.isPublished ?? true,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        createdById,
      },
    });

    await this.invalidate();
    return toClient(article);
  }

  async update(id: string, data: Partial<z.infer<typeof qaBodySchema>>) {
    const existing = await this.prisma.qaArticle.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, NOT_FOUND);

    const article = await this.prisma.qaArticle.update({
      where: { id },
      data: {
        ...(data.question !== undefined ? { question: data.question } : {}),
        ...(data.number !== undefined ? { questionNumber: data.number } : {}),
        ...(data.answer !== undefined ? { answer: data.answer } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        ...(data.publishedAt !== undefined ? { publishedAt: new Date(data.publishedAt) } : {}),
      },
    });

    await this.invalidate();
    return toClient(article);
  }

  async remove(id: string) {
    const existing = await this.prisma.qaArticle.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, NOT_FOUND);

    await this.prisma.qaArticle.delete({ where: { id } });
    await this.invalidate();
  }
}
