/**
 * QA H-2, phase 1.5:
 * - `completeLesson` requires the nearest earlier *published* lesson, so an unpublished lesson
 *   or a gap in lesson_order no longer lets a lesson be skipped;
 * - `POST …/lessons/:lessonId/complete` is limited to 5 per 60 s per user id (never by IP).
 *
 * Run (no database or network — repositories are mocks, the limiter uses the in-memory
 * ThrottlerStorageService of @nestjs/throttler):
 *   node --import tsx --test server/test/h2-phase15.test.ts
 *
 * Kept outside server/src so it is not part of the Nest build output.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { THROTTLER_LIMIT, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { AppError } from '../src/common/app-error';
import { JwtAuthGuard, type AuthUser } from '../src/common/auth';
import { UserThrottlerGuard } from '../src/common/user-throttler.guard';
import { ProgressController } from '../src/progress/progress.controller';
import { ProgressService } from '../src/progress/progress.service';

const COURSE_ID = 'c0000000-0000-4000-8000-000000000015';
const STUDENT: AuthUser = { id: 'u0000000-0000-4000-8000-000000000015', role: 'user' } as AuthUser;

type LessonRow = { id: string; courseId: string; isPublished: boolean; lessonOrder: number };

const opValue = (v: unknown) => (v as { value: unknown }).value;
const opType = (v: unknown) => (v as { type?: string } | undefined)?.type;

/** ProgressService with in-memory lessons / lesson_progress; the write transaction is only counted. */
function setup(opts: { lessons: LessonRow[]; done: string[]; canWatch?: boolean }) {
  const calls = {
    transaction: 0,
    predecessorQueries: [] as { where: Record<string, unknown>; order: unknown }[],
    progressChecked: [] as string[],
  };
  const lessons = {
    findOne: async (o: { where: Record<string, unknown>; order?: unknown }) => {
      const w = o.where;
      if (typeof w.id === 'string') {
        // the lesson being completed: must exist, be published and belong to the course
        const row = opts.lessons.find((l) => l.id === w.id && l.courseId === w.courseId && l.isPublished === w.isPublished);
        return row ? { id: row.id, lessonOrder: row.lessonOrder } : null;
      }
      calls.predecessorQueries.push({ where: w, order: o.order });
      const below = opValue(w.lessonOrder) as number;
      const candidates = opts.lessons
        .filter((l) => l.courseId === w.courseId && l.isPublished === w.isPublished && l.lessonOrder < below)
        .sort((a, b) => b.lessonOrder - a.lessonOrder);
      return candidates.length ? { id: candidates[0].id } : null;
    },
  };
  const lessonProgress = {
    findOne: async (o: { where: { userId: string; lessonId: string } }) => {
      calls.progressChecked.push(o.where.lessonId);
      return opts.done.includes(o.where.lessonId) ? { isLessonCompleted: true } : null;
    },
  };
  const ds = {
    transaction: async () => {
      calls.transaction += 1;
      return [[], []];
    },
  };
  const courses = {
    resolveId: async () => COURSE_ID,
    userCanWatchPaidCourse: async () => opts.canWatch ?? true,
  };
  const service = new ProgressService(
    lessons as never,
    {} as never,
    {} as never,
    lessonProgress as never,
    {} as never,
    {} as never,
    {} as never,
    ds as never,
    courses as never,
  );
  return { service, calls };
}

const L = (id: string, lessonOrder: number, isPublished = true, courseId = COURSE_ID): LessonRow => ({
  id,
  courseId,
  isPublished,
  lessonOrder,
});

function rejectsWith(status: number, error?: string) {
  return (err: unknown) => {
    assert.ok(err instanceof AppError, `expected AppError, got ${String(err)}`);
    assert.equal(err.getStatus(), status);
    if (error) assert.equal((err.getResponse() as { error: string }).error, error);
    return true;
  };
}

describe('completeLesson — nearest earlier published lesson must be completed', () => {
  const withGap = [L('L1', 1), L('L2', 2), L('L3', 3, false), L('L4', 4)];

  it('gap: L3 unpublished, L2 not completed → completing L4 is refused (400), nothing written', async () => {
    const { service, calls } = setup({ lessons: withGap, done: ['L1'] });
    await assert.rejects(service.completeLesson(STUDENT, COURSE_ID, 'L4'), rejectsWith(400, 'Мурунку сабакты бүтүрүңүз'));
    assert.deepEqual(calls.progressChecked, ['L2'], 'the predecessor must be L2, not the unpublished L3');
    assert.equal(calls.transaction, 0);
  });

  it('gap: L2 completed → L4 is marked', async () => {
    const { service, calls } = setup({ lessons: withGap, done: ['L1', 'L2'] });
    await service.completeLesson(STUDENT, COURSE_ID, 'L4');
    assert.deepEqual(calls.progressChecked, ['L2']);
    assert.equal(calls.transaction, 1);
  });

  it('a missing number (no lesson 3 at all) is skipped the same way', async () => {
    const { service, calls } = setup({ lessons: [L('L1', 1), L('L2', 2), L('L4', 4)], done: ['L1'] });
    await assert.rejects(service.completeLesson(STUDENT, COURSE_ID, 'L4'), rejectsWith(400, 'Мурунку сабакты бүтүрүңүз'));
    assert.equal(calls.transaction, 0);
  });

  it('the first published lesson may have any number (5) → no predecessor, marked', async () => {
    const { service, calls } = setup({ lessons: [L('L5', 5), L('L6', 6)], done: [] });
    await service.completeLesson(STUDENT, COURSE_ID, 'L5');
    assert.deepEqual(calls.progressChecked, []);
    assert.equal(calls.transaction, 1);
  });

  it('only unpublished lessons before it → treated as first, marked', async () => {
    const { service, calls } = setup({ lessons: [L('L1', 1, false), L('L2', 2)], done: [] });
    await service.completeLesson(STUDENT, COURSE_ID, 'L2');
    assert.deepEqual(calls.progressChecked, []);
    assert.equal(calls.transaction, 1);
  });

  it('regular sequence: previous done → marked; previous not done → 400 (unchanged behaviour)', async () => {
    const seq = [L('L1', 1), L('L2', 2), L('L3', 3)];
    const ok = setup({ lessons: seq, done: ['L1'] });
    await ok.service.completeLesson(STUDENT, COURSE_ID, 'L2');
    assert.equal(ok.calls.transaction, 1);

    const refused = setup({ lessons: seq, done: [] });
    await assert.rejects(refused.service.completeLesson(STUDENT, COURSE_ID, 'L2'), rejectsWith(400, 'Мурунку сабакты бүтүрүңүз'));
    assert.equal(refused.calls.transaction, 0);
  });

  it('first lesson (number 1) → marked without any predecessor check', async () => {
    const { service, calls } = setup({ lessons: [L('L1', 1), L('L2', 2)], done: [] });
    await service.completeLesson(STUDENT, COURSE_ID, 'L1');
    assert.deepEqual(calls.progressChecked, []);
    assert.equal(calls.transaction, 1);
  });

  it('an unpublished lesson or a lesson of another course → 404, nothing written (unchanged)', async () => {
    const rows = [L('L1', 1), L('L2', 2, false), L('X1', 1, true, 'other-course')];
    for (const id of ['L2', 'X1', 'missing']) {
      const { service, calls } = setup({ lessons: rows, done: ['L1'] });
      await assert.rejects(service.completeLesson(STUDENT, COURSE_ID, id), rejectsWith(404, 'Сабак табылган жок'));
      assert.equal(calls.transaction, 0);
    }
  });

  it('no access to the course → 403 before any lesson lookup (unchanged)', async () => {
    const { service, calls } = setup({ lessons: withGap, done: [], canWatch: false });
    await assert.rejects(service.completeLesson(STUDENT, COURSE_ID, 'L1'), rejectsWith(403, 'Курс ачыла элек'));
    assert.equal(calls.predecessorQueries.length, 0);
    assert.equal(calls.transaction, 0);
  });

  it('predecessor query: same course, published, lessonOrder < current, ordered DESC', async () => {
    const { service, calls } = setup({ lessons: withGap, done: ['L1', 'L2'] });
    await service.completeLesson(STUDENT, COURSE_ID, 'L4');
    const q = calls.predecessorQueries[0];
    assert.equal(q.where.courseId, COURSE_ID);
    assert.equal(q.where.isPublished, true);
    assert.equal(opType(q.where.lessonOrder), 'lessThan');
    assert.equal(opValue(q.where.lessonOrder), 4);
    assert.deepEqual(q.order, { lessonOrder: 'DESC' });
  });
});

/** Exposes the protected tracker for direct checks. */
class ProbeGuard extends UserThrottlerGuard {
  track(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

/** A real guard with the module's default throttler and a fresh in-memory storage. */
async function realGuard() {
  const storage = new ThrottlerStorageService();
  const guard = new ProbeGuard([{ ttl: 60_000, limit: 300 }], storage, new Reflector());
  await guard.onModuleInit();
  return { guard, storage };
}

function httpContext(req: Record<string, unknown>, handler: (...args: never[]) => unknown = ProgressController.prototype.complete) {
  const headers: Record<string, unknown> = {};
  const res = { header: (name: string, value: unknown) => void (headers[name] = value) };
  const context = {
    getHandler: () => handler,
    getClass: () => ProgressController,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res, getNext: () => undefined }),
  };
  return { context: context as never, headers };
}

describe('UserThrottlerGuard — key by user id', () => {
  it('tracker is "user:<id>"', async () => {
    const { guard, storage } = await realGuard();
    assert.equal(await guard.track({ user: { id: STUDENT.id } }), `user:${STUDENT.id}`);
    storage.onApplicationShutdown();
  });

  it('IP headers are ignored (CF-Connecting-IP / X-Forwarded-For / ip)', async () => {
    const { guard, storage } = await realGuard();
    const tracker = await guard.track({
      user: { id: STUDENT.id },
      headers: { 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.9' },
      ip: '192.0.2.1',
      ips: ['192.0.2.2'],
    });
    assert.equal(tracker, `user:${STUDENT.id}`);
    storage.onApplicationShutdown();
  });

  it('no user, or a user without an id → 401 (never falls back to the IP)', async () => {
    const { guard, storage } = await realGuard();
    for (const req of [{}, { user: {} }, { user: { id: '' } }, { headers: { 'cf-connecting-ip': '203.0.113.7' } }]) {
      await assert.rejects(guard.track(req), rejectsWith(401, 'Кирүү талап кылынат'));
    }
    storage.onApplicationShutdown();
  });
});

describe('POST …/lessons/:lessonId/complete — 5 per 60 s per user (in-memory storage)', () => {
  it('route metadata: UserThrottlerGuard + default limit 5 / ttl 60000; JwtAuthGuard on the controller', () => {
    const handler = ProgressController.prototype.complete;
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, handler), [UserThrottlerGuard]);
    assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, ProgressController), [JwtAuthGuard]);
    assert.equal(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler), 5);
    assert.equal(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler), 60_000);
  });

  it('the other progress routes get no limiter (get / sync / certificate)', () => {
    for (const name of ['get', 'sync', 'issueCertificate'] as const) {
      const handler = ProgressController.prototype[name];
      assert.equal(Reflect.getMetadata(GUARDS_METADATA, handler), undefined, name);
      assert.equal(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler), undefined, name);
    }
  });

  it('5 requests pass, the 6th gets 429; another user is not affected', async () => {
    const { guard, storage } = await realGuard();
    const alice = { user: { id: 'alice-0000' } };
    for (let i = 1; i <= 5; i += 1) {
      assert.equal(await guard.canActivate(httpContext(alice).context), true, `request ${i}`);
    }
    const sixth = httpContext(alice);
    await assert.rejects(guard.canActivate(sixth.context), (err: unknown) => {
      assert.ok(err instanceof ThrottlerException);
      assert.equal(err.getStatus(), 429);
      return true;
    });
    assert.ok(sixth.headers['Retry-After'] !== undefined, 'Retry-After header');

    const bob = { user: { id: 'bob-0000' } };
    assert.equal(await guard.canActivate(httpContext(bob).context), true);
    storage.onApplicationShutdown();
  });

  it('changing IP headers does not reset the limit for the same user', async () => {
    const { guard, storage } = await realGuard();
    for (let i = 1; i <= 5; i += 1) {
      const req = { user: { id: 'carol-0000' }, headers: { 'cf-connecting-ip': `203.0.113.${i}` } };
      assert.equal(await guard.canActivate(httpContext(req).context), true);
    }
    const req = { user: { id: 'carol-0000' }, headers: { 'cf-connecting-ip': '203.0.113.99' } };
    await assert.rejects(guard.canActivate(httpContext(req).context), ThrottlerException);
    storage.onApplicationShutdown();
  });

  it('a request without a user is refused with 401 by the limiter itself', async () => {
    const { guard, storage } = await realGuard();
    await assert.rejects(guard.canActivate(httpContext({}).context), rejectsWith(401, 'Кирүү талап кылынат'));
    storage.onApplicationShutdown();
  });
});
