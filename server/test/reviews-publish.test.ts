/**
 * Reviews are published immediately, without moderation:
 * - `create` stores the review as approved (not admin-posted) and only then drops the
 *   `reviews:` cache, so the next public / course list is read from PostgreSQL;
 * - the response carries the course slug and title, so the new card lands in the right row;
 * - the public and course lists only read approved reviews;
 * - the success message is translated for `ru`.
 *
 * Run (no database or network — repositories, cache and courses are mocks):
 *   node --import tsx --test server/test/reviews-publish.test.ts
 *
 * Kept outside server/src so it is not part of the Nest build output.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../src/common/app-error';
import type { AuthUser } from '../src/common/auth';
import { translateMessage } from '../src/common/i18n';
import { ReviewsService } from '../src/reviews/reviews.service';

const COURSE = {
  id: 'c0000000-0000-4000-8000-0000000000r1',
  slug: 'aqida',
  title: 'Акыйда',
  isPublished: true,
};
const STUDENT: AuthUser = { id: 'u0000000-0000-4000-8000-0000000000r1', role: 'user' } as AuthUser;

type Row = Record<string, unknown> & { id: string; status: string; courseId: string };

function setup(course: typeof COURSE | null = COURSE) {
  const rows: Row[] = [];
  const events: string[] = [];
  const queries: { where: unknown }[] = [];
  const user = { firstName: 'Айгүл', lastName: 'Асанова' };

  const withRelations = (row: Row, relations?: Record<string, boolean>) => ({
    ...row,
    user,
    ...(relations?.course ? { course: { title: COURSE.title, slug: COURSE.slug } } : {}),
  });

  const reviewRepo = {
    create: (data: Record<string, unknown>) => ({ ...data }),
    save: async (data: Record<string, unknown>) => {
      const now = new Date('2026-11-23T10:00:00Z');
      const row = { ...data, id: `r${rows.length + 1}`, createdAt: now, updatedAt: now } as Row;
      rows.push(row);
      events.push('save');
      return row;
    },
    findOneOrFail: async (o: { where: { id: string }; relations?: Record<string, boolean> }) => {
      const row = rows.find((r) => r.id === o.where.id);
      if (!row) throw new Error('not found');
      return withRelations(row, o.relations);
    },
    find: async (o: { where: unknown; relations?: Record<string, boolean> }) => {
      queries.push({ where: o.where });
      return rows.filter((r) => r.status === 'approved').map((r) => withRelations(r, o.relations));
    },
    count: async () => rows.filter((r) => r.status === 'approved').length,
    countBy: async () => rows.filter((r) => r.status === 'approved').length,
    findOne: async () => null,
    createQueryBuilder: () => {
      const qb = {
        select: () => qb,
        addSelect: () => qb,
        where: () => qb,
        andWhere: () => qb,
        getRawOne: async () => ({ avg: '5', count: String(rows.length) }),
      };
      return qb;
    },
  };

  const cache = {
    store: new Map<string, unknown>(),
    wrap: async (key: string, _ttl: number, loader: () => Promise<unknown>) => {
      if (cache.store.has(key)) return cache.store.get(key);
      const value = await loader();
      cache.store.set(key, value);
      return value;
    },
    invalidate: async (...prefixes: string[]) => {
      events.push(`invalidate:${prefixes.join(',')}`);
      for (const key of [...cache.store.keys()]) {
        if (prefixes.some((p) => key.startsWith(p))) cache.store.delete(key);
      }
    },
  };

  const courses = {
    resolveRef: async () => course,
    requireRef: async () => {
      if (!course) throw new AppError(404, 'Курс табылган жок');
      return course;
    },
  };

  const service = new ReviewsService(reviewRepo as never, cache as never, courses as never);
  return { service, rows, events, queries, cache };
}

describe('student reviews are published immediately', () => {
  it('stores the review as approved and returns it with its course', async () => {
    const { service, rows } = setup();
    const result = await service.create('aqida', STUDENT, {
      rating: 5,
      comment: '  Пайдалуу курс  ',
      displayName: 'Айгүл',
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'approved');
    assert.equal(rows[0].isAdminPosted, false);
    assert.equal(rows[0].userId, STUDENT.id);
    assert.equal(rows[0].courseId, COURSE.id);
    assert.equal(rows[0].comment, 'Пайдалуу курс');

    assert.equal(result.review.status, 'approved');
    assert.equal(result.review.comment, 'Пайдалуу курс');
    assert.equal(result.review.authorName, 'Айгүл');
    assert.equal(result.review.courseSlug, COURSE.slug);
    assert.equal(result.review.courseTitle, COURSE.title);
    assert.equal(result.message, 'Пикир чыгарылды');
  });

  it('drops the reviews cache after saving, so cached lists show the new review', async () => {
    const { service, events } = setup();

    const before = await service.listPublic({ page: 1, limit: 10 });
    const courseBefore = await service.listForCourse('aqida', { page: 1, limit: 10 }, undefined);
    assert.equal(before.items.length, 0);
    assert.equal(courseBefore.items.length, 0);

    const { review } = await service.create('aqida', STUDENT, { rating: 4, comment: 'Жакшы' });
    assert.deepEqual(events, ['save', 'invalidate:reviews:']);

    const after = await service.listPublic({ page: 1, limit: 10 });
    const courseAfter = await service.listForCourse('aqida', { page: 1, limit: 10 }, undefined);
    assert.deepEqual(after.items.map((r) => r.id), [review.id]);
    assert.deepEqual(courseAfter.items.map((r) => r.id), [review.id]);
    assert.equal(courseAfter.ratingsCount, 1);
  });

  it('public and course lists read approved reviews only', async () => {
    const { service, queries } = setup();
    await service.listPublic({ page: 1, limit: 10 });
    await service.listForCourse('aqida', { page: 1, limit: 10 }, undefined);

    const wheres = queries.flatMap((q) => (Array.isArray(q.where) ? q.where : [q.where]));
    assert.ok(wheres.length > 0);
    for (const where of wheres) assert.equal((where as { status: string }).status, 'approved');
  });

  it('refuses an unknown or unpublished course and saves nothing', async () => {
    const missing = setup(null);
    await assert.rejects(missing.service.create('nope', STUDENT, { rating: 5 }), { status: 404 });
    assert.equal(missing.rows.length, 0);

    const hidden = setup({ ...COURSE, isPublished: false });
    await assert.rejects(hidden.service.create('aqida', STUDENT, { rating: 5 }), { status: 404 });
    assert.equal(hidden.rows.length, 0);
  });

  it('translates the success message for ru', () => {
    assert.equal(translateMessage('Пикир чыгарылды', 'ru'), 'Отзыв опубликован');
    assert.equal(translateMessage('Пикир чыгарылды', 'kg'), 'Пикир чыгарылды');
  });
});
