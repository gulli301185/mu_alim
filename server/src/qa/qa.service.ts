import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, FindOptionsOrder, FindOptionsWhere, Repository, Brackets, DataSource } from 'typeorm';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { CacheService } from '../cache/cache.service';
import { QaArticle } from '../database/entities';
import { containsInsensitive } from '../database/sql';
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

const questionNumberAsc = { direction: 'ASC', nulls: 'LAST' } as const;

function orderFor(sort: z.infer<typeof sortSchema>): FindOptionsOrder<QaArticle> {
  switch (sort) {
    case 'newest':
      return { publishedAt: 'DESC', questionNumber: questionNumberAsc };
    case 'oldest':
      return { publishedAt: 'ASC', questionNumber: questionNumberAsc };
    case 'popular':
      return {
        views: 'DESC',
        siteViews: 'DESC',
        telegramViews: 'DESC',
        questionNumber: questionNumberAsc,
      };
    default:
      return { questionNumber: questionNumberAsc, publishedAt: 'DESC' };
  }
}

@Injectable()
export class QaService {
  constructor(
    @InjectRepository(QaArticle) private readonly articles: Repository<QaArticle>,
    private readonly ds: DataSource,
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
        let where: FindOptionsWhere<QaArticle>[] = [{ isPublished: true }];
        if (search) {
          const like = containsInsensitive(search);
          where = [
            { isPublished: true, question: like },
            { isPublished: true, answer: like },
            { isPublished: true, tags: ArrayContains([search.toLowerCase()]) },
          ];
          const questionNumber = parseQuestionNumberSearch(search);
          if (questionNumber != null) where.unshift({ isPublished: true, questionNumber });
        }

        const [items, total] = await Promise.all([
          this.articles.find({
            where,
            order: orderFor(sort),
            skip: (page - 1) * limit,
            take: limit,
          }),
          this.articles.count({ where }),
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
        const where = { isPublished: true };
        const total = await this.articles.countBy(where);
        if (total === 0) return null;

        const [article] = await this.articles.find({
          where,
          order: { questionNumber: questionNumberAsc, publishedAt: 'ASC' },
          skip: dailySkip(date, total),
          take: 1,
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

    const result = await importQaArticles(this.ds, items);
    await this.invalidate();
    return { message: 'Телеграм экспорту ийгиликтүү импорт кылынды', ...result };
  }

  async getBySlug(slug: string) {
    const result = await this.cache.wrap<ClientArticle | null>(`qa:article:${slug}`, ARTICLE_TTL, async () => {
      const article = await this.articles.findOneBy({ slug, isPublished: true });
      if (!article) return null;

      const client = toClient(article);
      if (client.number == null) {
        const rank = await this.articles
          .createQueryBuilder('a')
          .where('a.isPublished = true')
          .andWhere(
            new Brackets((w) => {
              w.where('a.publishedAt < :publishedAt').orWhere(
                'a.publishedAt = :publishedAt AND a.createdAt < :createdAt',
              );
            }),
            { publishedAt: article.publishedAt, createdAt: article.createdAt },
          )
          .getCount();
        client.number = rank + 1;
      }
      return client;
    });

    if (!result) throw new AppError(404, NOT_FOUND);
    return result;
  }

  async registerView(slug: string) {
    const article = await this.articles.findOneBy({ slug, isPublished: true });
    if (!article) throw new AppError(404, NOT_FOUND);

    // One atomic statement: bump the site counter and keep the combined total in sync.
    await this.articles
      .createQueryBuilder()
      .update(QaArticle)
      .set({
        siteViews: () => 'site_views + 1',
        views: () => 'telegram_views + site_views + 1',
        updatedAt: new Date(),
      })
      .where('id = :id', { id: article.id })
      .execute();

    const updated = await this.articles.findOneOrFail({
      where: { id: article.id },
      select: { telegramViews: true, siteViews: true },
    });

    return { views: (updated.telegramViews ?? 0) + (updated.siteViews ?? 0) };
  }

  async create(data: z.infer<typeof qaBodySchema>, createdById?: string) {
    const slug = await uniqueSlug(data.question, async (s) => {
      const found = await this.articles.findOneBy({ slug: s });
      return Boolean(found);
    });

    const article = await this.articles.save(
      this.articles.create({
        slug,
        questionNumber: data.number ?? null,
        question: data.question,
        answer: data.answer,
        excerpt: null,
        tags: data.tags ?? [],
        type: data.type ?? 'text',
        isPublished: data.isPublished ?? true,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        createdById: createdById ?? null,
      }),
    );

    await this.invalidate();
    return toClient(article);
  }

  async update(id: string, data: Partial<z.infer<typeof qaBodySchema>>) {
    const existing = await this.articles.findOneBy({ id });
    if (!existing) throw new AppError(404, NOT_FOUND);

    if (data.question !== undefined) existing.question = data.question;
    if (data.number !== undefined) existing.questionNumber = data.number;
    if (data.answer !== undefined) existing.answer = data.answer;
    if (data.tags !== undefined) existing.tags = data.tags;
    if (data.type !== undefined) existing.type = data.type;
    if (data.isPublished !== undefined) existing.isPublished = data.isPublished;
    if (data.publishedAt !== undefined) existing.publishedAt = new Date(data.publishedAt);
    const article = await this.articles.save(existing);

    await this.invalidate();
    return toClient(article);
  }

  async remove(id: string) {
    const existing = await this.articles.findOneBy({ id });
    if (!existing) throw new AppError(404, NOT_FOUND);

    await this.articles.delete({ id });
    await this.invalidate();
  }
}
