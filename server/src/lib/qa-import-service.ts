import type { PrismaClient } from '@prisma/client';
import { uniqueSlug } from './slug.js';
import type { ParsedTelegramQa } from './telegram-html-parser.js';

export type QaImportResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
};

export async function importQaArticles(
  prisma: PrismaClient,
  items: ParsedTelegramQa[],
  options: { renumber?: boolean; replaceAll?: boolean } = {},
): Promise<QaImportResult> {
  if (options.replaceAll) {
    await prisma.qaArticle.deleteMany({});
  }
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const existing = await prisma.qaArticle.findFirst({
      where: {
        OR: [{ questionNumber: item.number }, { question: item.question }],
      },
    });

    if (existing) {
      const telegramViews = item.telegramViews ?? existing.telegramViews;
      const siteViews = existing.siteViews;
      const totalViews = telegramViews + siteViews;
      const needsUpdate =
        existing.answer !== item.answer ||
        existing.question !== item.question ||
        existing.questionNumber !== item.number ||
        existing.telegramViews !== telegramViews;

      if (needsUpdate) {
        await prisma.qaArticle.update({
          where: { id: existing.id },
          data: {
            question: item.question,
            answer: item.answer,
            questionNumber: item.number,
            tags: item.tags,
            publishedAt: new Date(item.publishedAt),
            isPublished: true,
            telegramViews,
            views: totalViews,
          },
        });
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const slug = await uniqueSlug(`suroo-${item.number}`, async (s) => {
      const found = await prisma.qaArticle.findUnique({ where: { slug: s } });
      return Boolean(found);
    });

    await prisma.qaArticle.create({
      data: {
        slug,
        questionNumber: item.number,
        question: item.question,
        answer: item.answer,
        tags: item.tags,
        publishedAt: new Date(item.publishedAt),
        type: 'text',
        isPublished: true,
        telegramViews: item.telegramViews ?? 0,
        views: item.telegramViews ?? 0,
      },
    });
    created += 1;
  }

  if (options.renumber) {
    const articles = await prisma.qaArticle.findMany({
      where: { isPublished: true },
      orderBy: [{ questionNumber: { sort: 'asc', nulls: 'last' } }, { publishedAt: 'asc' }],
    });

    for (let i = 0; i < articles.length; i++) {
      await prisma.qaArticle.update({
        where: { id: articles[i].id },
        data: { questionNumber: i + 1 },
      });
    }
  }

  return { total: items.length, created, updated, skipped };
}
