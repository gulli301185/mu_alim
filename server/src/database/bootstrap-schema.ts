import { Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import { uniqueSlug } from '../lib/slug';
import { ensureFinalTests } from './ensure-final-tests';
import { Course, QaArticle, Review, User } from './entities';

const SCHEMA_FILE = resolve(__dirname, '../../db/schema.sql');
const FREE_CATALOGUE_FILE = resolve(__dirname, '../../db/free-lessons.sql');
const PAID_CATALOGUE_FILE = resolve(__dirname, '../../db/paid-courses.sql');
const QA_SEED_FILE = resolve(__dirname, '../../db/qa-seed.json');
const TEXT_REVIEWS_SEED_FILE = resolve(__dirname, '../../db/text-reviews-seed.json');

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
  const seededPaid = await ensurePaidCatalogue(ds);
  const seededQa = await ensureQaCatalogue(ds);
  if (seededFree || seededPaid) await cache?.invalidate('courses:');
  if (seededQa) await cache?.invalidate('qa:');
  await ensureAdmin(ds);
  const seededReviews = await ensureVideoReviews(ds);
  const seededTextReviews = await ensureTextReviews(ds);
  if (seededReviews || seededTextReviews) await cache?.invalidate('reviews:');
  const seededTests = await ensureFinalTests(ds);
  if (seededTests) await cache?.invalidate('courses:');
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

function paidCataloguePath() {
  return [PAID_CATALOGUE_FILE, resolve(__dirname, '../db/paid-courses.sql')].find((path) =>
    existsSync(path),
  );
}

function paidCourseIdsFromSql(sql: string) {
  const ids: string[] = [];
  for (const line of sql.split('\n')) {
    if (!line.includes('INSERT INTO public.courses') || !line.includes(", 'paid',")) continue;
    const match = line.match(/VALUES \('([0-9a-f-]{36})'/i);
    if (match) ids.push(match[1]);
  }
  return ids;
}

/**
 * Loads paid courses and their lessons when none are published yet.
 */
async function ensurePaidCatalogue(ds: DataSource): Promise<boolean> {
  const logger = new Logger('Database');
  const file = paidCataloguePath();
  if (!file) return false;

  const [{ n }] = await ds.query(`
    SELECT COUNT(*)::int AS n
    FROM courses
    WHERE course_type = 'paid' AND is_published = true
  `);
  if (n > 0) return false;

  const sql = readFileSync(file, 'utf8');
  const paidIds = paidCourseIdsFromSql(sql);
  const statements = sql
    .split('\n')
    .filter((line) => {
      if (line.includes("INSERT INTO public.categories") && line.includes("'paid-courses'")) return true;
      if (line.includes('INSERT INTO public.courses') && line.includes(", 'paid',")) return true;
      if (line.includes('INSERT INTO public.lessons') && paidIds.some((id) => line.includes(`'${id}'`))) {
        return true;
      }
      return false;
    });
  if (statements.length === 0) return false;

  const runner = ds.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  try {
    for (const statement of statements) {
      await runner.query(statement);
    }
    await runner.commitTransaction();
    logger.log(`Loaded ${paidIds.length} paid courses from db/paid-courses.sql`);
    return true;
  } catch (err) {
    await runner.rollbackTransaction();
    logger.error(`Failed to load paid courses: ${(err as Error).message}`);
    return false;
  } finally {
    await runner.release();
  }
}

function qaSeedPath() {
  return [
    QA_SEED_FILE,
    resolve(__dirname, '../db/qa-seed.json'),
    resolve(__dirname, '../../../client/src/data/telegram-questions.json'),
  ].find((path) => existsSync(path));
}

/**
 * Loads published Q&A when the table is empty so /api/qa/daily is not blank.
 */
async function ensureQaCatalogue(ds: DataSource): Promise<boolean> {
  const logger = new Logger('Database');
  const file = qaSeedPath();
  if (!file) return false;

  type SeedItem = {
    id: string;
    number?: number;
    question: string;
    answer: string;
    tags?: string[];
    publishedAt: string;
  };
  const items = JSON.parse(readFileSync(file, 'utf8')) as SeedItem[];
  if (!items.length) return false;

  const [{ n }] = await ds.query(`SELECT COUNT(*)::int AS n FROM qa_articles WHERE is_published = true`);
  if (n >= items.length) return false;

  const articles = ds.getRepository(QaArticle);
  try {
    let created = 0;
    for (const item of items) {
      const exists = await articles.findOneBy({ question: item.question });
      if (exists) continue;
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
    if (created === 0) return false;
    logger.log(`Loaded ${created} Q&A articles from ${file}`);
    return true;
  } catch (err) {
    logger.error(`Failed to load Q&A: ${(err as Error).message}`);
    return false;
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

const VIDEO_REVIEW_FILES = [
  'family-otz1.mp4',
  'family-otz2.mp4',
  'family-otz3.mp4',
  'family-otz4.mp4',
  'family-otz5.mp4',
  'family-otz6.mp4',
  'family-otz7.mp4',
  'family-otz8.mp4',
  'family-otzyv.mp4',
  'family-img-2047.mp4',
] as const;

function reviewsUploadDir() {
  return [
    resolve(__dirname, '../../uploads/reviews'),
    resolve(__dirname, '../uploads/reviews'),
  ].find((path) => existsSync(path));
}

async function reviewAuthor(ds: DataSource) {
  const users = ds.getRepository(User);
  const admin = await users.findOneBy({ role: 'admin' });
  if (admin) return admin;

  const email = 'reviews@mualim.kg';
  const existing = await users.findOneBy({ email });
  if (existing) return existing;

  return users.save(
    users.create({
      email,
      passwordHash: await bcrypt.hash(randomUUID(), 10),
      firstName: 'Окуучу',
      lastName: '',
      phone: null,
      role: 'user',
      isActive: true,
      isVerified: true,
      lastLoginAt: null,
    }),
  );
}

/**
 * Loads the family video reviews when none are published yet.
 * Video files ship in `uploads/reviews` with the API image.
 */
async function ensureVideoReviews(ds: DataSource): Promise<boolean> {
  const logger = new Logger('Database');
  const [{ n }] = await ds.query(`
    SELECT COUNT(*)::int AS n
    FROM reviews
    WHERE status = 'approved' AND video_url IS NOT NULL AND btrim(video_url) <> ''
  `);
  if (n > 0) return false;

  const uploads = reviewsUploadDir();
  if (!uploads) {
    logger.warn('Video reviews were not loaded — uploads/reviews is missing');
    return false;
  }

  const course = await ds.getRepository(Course).findOneBy({ slug: 'family' });
  if (!course) {
    logger.warn('Video reviews were not loaded — family course is missing');
    return false;
  }

  const author = await reviewAuthor(ds);
  const reviews = ds.getRepository(Review);
  let created = 0;

  for (const file of VIDEO_REVIEW_FILES) {
    const videoFile = resolve(uploads, file);
    if (!existsSync(videoFile)) continue;
    const videoUrl = `/uploads/reviews/${file}`;
    if (await reviews.findOneBy({ videoUrl })) continue;

    await reviews.save(
      reviews.create({
        userId: author.id,
        courseId: course.id,
        rating: 5,
        comment: null,
        videoUrl,
        displayName: 'Окуучу',
        isAdminPosted: true,
        status: 'approved',
      }),
    );
    created += 1;
  }

  if (created === 0) return false;
  logger.log(`Loaded ${created} video reviews`);
  return true;
}

function textReviewsSeedPath() {
  return [TEXT_REVIEWS_SEED_FILE, resolve(__dirname, '../db/text-reviews-seed.json')].find((path) =>
    existsSync(path),
  );
}

/**
 * Loads approved text reviews when the public catalogue is still nearly empty.
 */
async function ensureTextReviews(ds: DataSource): Promise<boolean> {
  const logger = new Logger('Database');
  const file = textReviewsSeedPath();
  if (!file) return false;

  type SeedItem = {
    courseSlug: string;
    rating: number;
    comment: string;
    authorName: string;
    createdAt?: string;
  };
  const items = JSON.parse(readFileSync(file, 'utf8')) as SeedItem[];
  if (!items.length) return false;

  const [{ n }] = await ds.query(`
    SELECT COUNT(*)::int AS n
    FROM reviews
    WHERE status = 'approved' AND comment IS NOT NULL AND btrim(comment) <> ''
  `);
  if (n >= items.length) return false;

  const author = await reviewAuthor(ds);
  const courses = ds.getRepository(Course);
  const reviews = ds.getRepository(Review);
  const courseCache = new Map<string, string>();
  let created = 0;

  for (const item of items) {
    const comment = item.comment.trim();
    if (!comment) continue;
    if (await reviews.findOneBy({ comment })) continue;

    let courseId = courseCache.get(item.courseSlug);
    if (!courseId) {
      const course = await courses.findOneBy({ slug: item.courseSlug });
      if (!course) continue;
      courseId = course.id;
      courseCache.set(item.courseSlug, courseId);
    }

    await reviews.save(
      reviews.create({
        userId: author.id,
        courseId,
        rating: item.rating || 5,
        comment,
        videoUrl: null,
        displayName: item.authorName?.trim() || 'Окуучу',
        isAdminPosted: true,
        status: 'approved',
      }),
    );
    created += 1;
  }

  if (created === 0) return false;
  logger.log(`Loaded ${created} text reviews`);
  return true;
}
