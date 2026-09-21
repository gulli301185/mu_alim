import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import { connectScriptDb } from './database/data-source';
import { QaArticle, User } from './database/entities';
import { upsertBy } from './database/data-source';
import { uniqueSlug } from './lib/slug.js';

let ds: DataSource;

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

  await upsertBy(
    ds,
    User,
    { email },
    { role: 'admin', passwordHash: hash, isActive: true },
    {
      email,
      passwordHash: hash,
      firstName: 'Admin',
      lastName: 'Mualim',
      phone: null,
      role: 'admin',
      isActive: true,
      isVerified: true,
      lastLoginAt: null,
    },
  );

  console.log(`✓ Admin: ${email}`);
}

async function seedQa(sourcePath?: string) {
  const jsonPath =
    sourcePath ??
    resolve(__dirname, '../../client/src/data/telegram-questions.json');
  const items = JSON.parse(readFileSync(jsonPath, 'utf8')) as SeedItem[];

  const articles = ds.getRepository(QaArticle);
  let created = 0;
  let skipped = 0;
  for (const item of items) {
    const exists = await articles.findOneBy({ question: item.question });
    if (exists) {
      if (item.number != null && exists.questionNumber !== item.number) {
        await articles.update({ id: exists.id }, { questionNumber: item.number, updatedAt: new Date() });
      }
      skipped += 1;
      continue;
    }

    const slug = await uniqueSlug(item.id || item.question, async (s) => {
      const found = await articles.findOneBy({ slug: s });
      return Boolean(found);
    });

    await articles.save(
      articles.create({
        slug,
        questionNumber: item.number ?? null,
        question: item.question,
        answer: item.answer,
        excerpt: null,
        tags: item.tags ?? [],
        publishedAt: new Date(item.publishedAt),
        type: 'text',
        isPublished: true,
        createdById: null,
      }),
    );
    created += 1;
  }

  console.log(`✓ QA articles: ${created} жаңы, ${skipped} бар (${items.length} JSON ичинде)`);
}

async function renumberAll() {
  const repo = ds.getRepository(QaArticle);
  const articles = await repo.find({
    where: { isPublished: true },
    order: { publishedAt: 'ASC', createdAt: 'ASC' },
  });

  for (let i = 0; i < articles.length; i++) {
    await repo.update({ id: articles[i].id }, { questionNumber: i + 1, updatedAt: new Date() });
  }

  console.log(`✓ Номерлер: 1–${articles.length} (кайра номерленди)`);
}

async function main() {
  ds = await connectScriptDb();
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
    await ds?.destroy();
  });
