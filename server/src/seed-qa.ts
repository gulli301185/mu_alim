import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { uniqueSlug } from './lib/slug.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));

type SeedItem = {
  id: string;
  number?: number;
  question: string;
  answer: string;
  tags?: string[];
  publishedAt: string;
};

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@mualim.academy';
  const password = process.env.ADMIN_PASSWORD ?? 'admin123456';
  const hash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { role: 'admin', passwordHash: hash, isActive: true },
    create: {
      email,
      passwordHash: hash,
      firstName: 'Admin',
      lastName: 'Mualim',
      role: 'admin',
      isActive: true,
      isVerified: true,
    },
  });

  console.log(`✓ Admin: ${email}`);
}

async function seedQa(sourcePath?: string) {
  const jsonPath =
    sourcePath ??
    resolve(__dirname, '../../client/src/data/telegram-questions.json');
  const items = JSON.parse(readFileSync(jsonPath, 'utf8')) as SeedItem[];

  let created = 0;
  let skipped = 0;
  for (const item of items) {
    const exists = await prisma.qaArticle.findFirst({
      where: { question: item.question },
    });
    if (exists) {
      if (item.number != null && exists.questionNumber !== item.number) {
        await prisma.qaArticle.update({
          where: { id: exists.id },
          data: { questionNumber: item.number },
        });
      }
      skipped += 1;
      continue;
    }

    const slug = await uniqueSlug(item.id || item.question, async (s) => {
      const found = await prisma.qaArticle.findUnique({ where: { slug: s } });
      return Boolean(found);
    });

    await prisma.qaArticle.create({
      data: {
        slug,
        questionNumber: item.number,
        question: item.question,
        answer: item.answer,
        tags: item.tags ?? [],
        publishedAt: new Date(item.publishedAt),
        type: 'text',
        isPublished: true,
      },
    });
    created += 1;
  }

  console.log(`✓ QA articles: ${created} жаңы, ${skipped} бар (${items.length} JSON ичинде)`);
}

async function renumberAll() {
  const articles = await prisma.qaArticle.findMany({
    where: { isPublished: true },
    orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
  });

  for (let i = 0; i < articles.length; i++) {
    await prisma.qaArticle.update({
      where: { id: articles[i].id },
      data: { questionNumber: i + 1 },
    });
  }

  console.log(`✓ Номерлер: 1–${articles.length} (кайра номерленди)`);
}

async function main() {
  const sourcePath = process.argv[2];
  await seedAdmin();
  await seedQa(sourcePath);
  await renumberAll();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
