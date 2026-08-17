import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.qaArticle.findMany({
    select: { id: true, siteViews: true },
  });

  for (const article of articles) {
    const telegramViews = Math.floor(Math.random() * 200) + 1;
    await prisma.qaArticle.update({
      where: { id: article.id },
      data: {
        telegramViews,
        views: telegramViews + article.siteViews,
      },
    });
  }

  const top = await prisma.qaArticle.findMany({
    take: 5,
    orderBy: { views: 'desc' },
    select: { questionNumber: true, telegramViews: true, siteViews: true, views: true },
  });

  console.log(`✓ ${articles.length} суроого Телеграм көрүүлөрү кошулду (1–200)`);
  console.log('Мисал (топ 5):', top);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
