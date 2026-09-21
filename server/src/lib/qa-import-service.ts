import { DataSource } from 'typeorm';
import { QaArticle } from '../database/entities';
import { uniqueSlug } from './slug';
import type { ParsedTelegramQa } from './telegram-html-parser';

export type QaImportResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
};

export async function importQaArticles(
  ds: DataSource,
  items: ParsedTelegramQa[],
  options: { renumber?: boolean; replaceAll?: boolean } = {},
): Promise<QaImportResult> {
  const articles = ds.getRepository(QaArticle);

  if (options.replaceAll) {
    await articles.createQueryBuilder().delete().execute();
  }
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const existing = await articles.findOne({
      where: [{ questionNumber: item.number }, { question: item.question }],
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
        Object.assign(existing, {
          question: item.question,
          answer: item.answer,
          questionNumber: item.number,
          tags: item.tags,
          publishedAt: new Date(item.publishedAt),
          isPublished: true,
          telegramViews,
          views: totalViews,
        });
        await articles.save(existing);
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    const slug = await uniqueSlug(`suroo-${item.number}`, async (s) => {
      const found = await articles.findOneBy({ slug: s });
      return Boolean(found);
    });

    await articles.save(
      articles.create({
        slug,
        questionNumber: item.number,
        question: item.question,
        answer: item.answer,
        excerpt: null,
        tags: item.tags,
        publishedAt: new Date(item.publishedAt),
        type: 'text',
        isPublished: true,
        telegramViews: item.telegramViews ?? 0,
        siteViews: 0,
        views: item.telegramViews ?? 0,
        createdById: null,
      }),
    );
    created += 1;
  }

  if (options.renumber) {
    const published = await articles.find({
      where: { isPublished: true },
      order: { questionNumber: { direction: 'ASC', nulls: 'LAST' }, publishedAt: 'ASC' },
    });

    for (let i = 0; i < published.length; i++) {
      await articles.update({ id: published[i].id }, { questionNumber: i + 1, updatedAt: new Date() });
    }
  }

  return { total: items.length, created, updated, skipped };
}
