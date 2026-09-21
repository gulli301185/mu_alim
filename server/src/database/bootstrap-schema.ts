import { Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import { User } from './entities';

const SCHEMA_FILE = resolve(__dirname, '../../db/schema.sql');
const FREE_CATALOGUE_FILE = resolve(__dirname, '../../db/free-lessons.sql');

/**
 * Creates the tables from `db/schema.sql` when the database is empty (no `users` table).
 * An already-initialised database is never touched.
 */
export async function ensureSchema(
  ds: DataSource,
  cache?: { invalidate: (...prefixes: string[]) => Promise<void> },
) {
  await createSchemaIfEmpty(ds);
  const seededFree = await ensureFreeCatalogue(ds);
  if (seededFree) await cache?.invalidate('courses:');
  await ensureAdmin(ds);
}

async function createSchemaIfEmpty(ds: DataSource) {
  const logger = new Logger('Database');
  const [{ exists }] = await ds.query(`SELECT to_regclass('public.users') IS NOT NULL AS exists`);
  if (exists) return;

  if (!existsSync(SCHEMA_FILE)) {
    logger.error(`Database is empty and ${SCHEMA_FILE} was not found — tables were not created`);
    return;
  }

  logger.warn('Database is empty — creating the schema from db/schema.sql');
  // pg_dump clears search_path for the session; keep it so unqualified table names still resolve.
  const sql = readFileSync(SCHEMA_FILE, 'utf8').replace(
    /SELECT pg_catalog\.set_config\('search_path', '', false\);/g,
    '',
  );

  const runner = ds.createQueryRunner();
  try {
    await runner.startTransaction();
    await runner.query(sql);
    await runner.commitTransaction();
    logger.log('Schema created.');
  } catch (err) {
    await runner.rollbackTransaction();
    throw err;
  } finally {
    await runner.release();
  }

}

const FREE_COURSE_ID = 'ca4f6ef6-4636-47c1-82d6-4bef3a29c7e7';
const FREE_CATEGORY_ID = '4114cdff-78bd-4197-8ba7-e80edf58f7a3';

function freeCataloguePath() {
  return [FREE_CATALOGUE_FILE, resolve(__dirname, '../db/free-lessons.sql')].find((path) =>
    existsSync(path),
  );
}

/**
 * Loads the public free course and its lessons when none are published yet.
 * Paid courses (or a leftover unpublished free row) do not skip this.
 */
async function ensureFreeCatalogue(ds: DataSource): Promise<boolean> {
  const logger = new Logger('Database');
  const file = freeCataloguePath();
  if (!file) return false;

  const [{ n }] = await ds.query(`
    SELECT COUNT(*)::int AS n
    FROM lessons l
    INNER JOIN courses c ON c.id = l.course_id
    WHERE c.course_type = 'free' AND c.is_published = true AND l.is_published = true
  `);
  if (n > 0) return false;

  const runner = ds.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    await runner.query(
      `INSERT INTO categories (id, name, slug, description, is_active, created_at, updated_at)
       VALUES ($1, 'Бекер курстар', 'free-courses', 'Бекер видео баяндар жана сабактар', true, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [FREE_CATEGORY_ID],
    );
    const [category] = await runner.query(`SELECT id FROM categories WHERE slug = 'free-courses'`);
    if (!category) throw new Error('Free category is missing');

    await runner.query(
      `INSERT INTO courses (
         id, category_id, title, slug, short_description, description, cover_image,
         course_type, price, currency, level, duration_minutes, passing_score,
         is_popular, is_published, published_at, created_at, updated_at
       ) VALUES (
         $1, $2, 'Бекер баяндар', 'free-bayanlar', NULL,
         'Муалим академиясынын бекер видео баяндары — YouTube шилтемелери аркылуу.',
         NULL, 'free', 0, 'KGS', NULL, NULL, 80, false, true, NOW(), NOW(), NOW()
       )
       ON CONFLICT DO NOTHING`,
      [FREE_COURSE_ID, category.id],
    );
    await runner.query(
      `UPDATE courses
       SET course_type = 'free',
           is_published = true,
           published_at = COALESCE(published_at, NOW()),
           updated_at = NOW()
       WHERE slug = 'free-bayanlar'`,
    );
    const [course] = await runner.query(`SELECT id FROM courses WHERE slug = 'free-bayanlar'`);
    if (!course) throw new Error('Free course is missing');

    const lessonSql = readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => line.includes('INSERT INTO public.lessons'))
      .map((line) => line.replaceAll(`'${FREE_COURSE_ID}'`, `'${course.id}'`))
      .join('\n');
    if (lessonSql) await runner.query(lessonSql);
    await runner.query(
      `UPDATE lessons SET is_published = true, updated_at = NOW()
       WHERE course_id = $1 AND is_published = false`,
      [course.id],
    );

    await runner.commitTransaction();
    logger.log('Loaded the free course and its lessons from db/free-lessons.sql');
    return true;
  } catch (err) {
    await runner.rollbackTransaction();
    logger.error(`Failed to load free lessons: ${(err as Error).message}`);
    return false;
  } finally {
    await runner.release();
  }
}

/**
 * Creates the first admin from `ADMIN_EMAIL` + `ADMIN_PASSWORD` when the database has no admin yet.
 * Nothing happens without an explicit password, and an existing admin is never modified.
 */
async function ensureAdmin(ds: DataSource) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const users = ds.getRepository(User);
  if (await users.existsBy({ role: 'admin' })) return;

  await users.save(
    users.create({
      email,
      passwordHash: await bcrypt.hash(password, 10),
      firstName: 'Admin',
      lastName: 'Mualim',
      phone: null,
      role: 'admin',
      isActive: true,
      isVerified: true,
      lastLoginAt: null,
    }),
  );
  new Logger('Database').log(`Created the first admin account: ${email}`);
}
