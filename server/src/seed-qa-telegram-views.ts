import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import { connectScriptDb } from './database/data-source';
import { QaArticle } from './database/entities';

let ds: DataSource;

async function main() {
  ds = await connectScriptDb();
  const repo = ds.getRepository(QaArticle);
  const articles = await repo.find({ select: { id: true, siteViews: true } });

  for (const article of articles) {
    const telegramViews = Math.floor(Math.random() * 200) + 1;
    await repo.update(
      { id: article.id },
      { telegramViews, views: telegramViews + article.siteViews, updatedAt: new Date() },
    );
  }

  const top = await repo.find({
    take: 5,
    order: { views: 'DESC' },
    select: { questionNumber: true, telegramViews: true, siteViews: true, views: true },
  });

  console.log(`✓ ${articles.length} суроого Телеграм көрүүлөрү кошулду (1–200)`);
  console.log(
    'Мисал (топ 5):',
    top.map(({ questionNumber, telegramViews, siteViews, views }) => ({
      questionNumber,
      telegramViews,
      siteViews,
      views,
    })),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await ds?.destroy();
  });
