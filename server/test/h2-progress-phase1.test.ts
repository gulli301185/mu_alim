/**
 * QA H-2, phase 1: lesson progress is decided on the server.
 * - `progress/sync` no longer writes anything a client sends (it only reports server state);
 * - one rule (`getLessonCompletion`) — every published lesson recorded in lesson_progress —
 *   gates the final exam (GET questions / POST grade) and new certificates;
 * - `enrollments.completed_at` / `course_progress.is_completed` never prove completion alone.
 *
 * Run (no database — repositories, DataSource and services are in-memory mocks):
 *   node --import tsx --test server/test/h2-progress-phase1.test.ts
 *
 * Kept outside server/src so it is not part of the Nest build output.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EntityTarget, FindManyOptions, ObjectLiteral } from 'typeorm';
import { AppError } from '../src/common/app-error';
import type { AuthUser } from '../src/common/auth';
import { Lesson, LessonProgress } from '../src/database/entities';
import { getLessonCompletion } from '../src/progress/lesson-completion';
import { ProgressService } from '../src/progress/progress.service';
import { TestsController } from '../src/tests/tests.controller';

const COURSE_ID = 'c0000000-0000-4000-8000-000000000001';
const STUDENT: AuthUser = { id: 'u0000000-0000-4000-8000-000000000001', role: 'user' } as AuthUser;
const ADMIN: AuthUser = { id: 'a0000000-0000-4000-8000-000000000001', role: 'admin' } as AuthUser;

type LessonRow = { id: string; courseId: string; isPublished: boolean; lessonOrder: number };
type ProgressRow = { userId: string; lessonId: string; isLessonCompleted: boolean };

/** Three lessons: L1, L2 published; L3 unpublished (must never be required). */
function lessons(): LessonRow[] {
  return [
    { id: 'L1', courseId: COURSE_ID, isPublished: true, lessonOrder: 1 },
    { id: 'L2', courseId: COURSE_ID, isPublished: true, lessonOrder: 2 },
    { id: 'L3', courseId: COURSE_ID, isPublished: false, lessonOrder: 3 },
  ];
}

const opValue = (v: unknown) => (v as { value: unknown }).value;
const opType = (v: unknown) => (v as { type?: string } | undefined)?.type;

/** In-memory stand-in for EntityManager.find over lessons / lesson_progress. */
function fakeManager(lessonRows: LessonRow[], progressRows: ProgressRow[]) {
  const calls = { find: [] as { entity: unknown; where: Record<string, unknown> }[] };
  // Same generic signature as EntityManager.find(entity, options?); the rows it returns are
  // fabricated, so they are the one place that needs a cast to the requested entity type.
  async function find<E extends ObjectLiteral>(entity: EntityTarget<E>, opts?: FindManyOptions<E>): Promise<E[]> {
    const w: Record<string, unknown> = { ...(opts?.where as object | undefined) };
    calls.find.push({ entity, where: w });
    if (entity === Lesson) {
      const rows = lessonRows
        .filter((l) => l.courseId === w.courseId && (w.isPublished === undefined || l.isPublished === w.isPublished))
        .map((l) => ({ id: l.id }));
      return rows as unknown as E[];
    }
    if (entity === LessonProgress) {
      const ids = opValue(w.lessonId) as string[];
      const rows = progressRows
        .filter((p) => p.userId === w.userId && p.isLessonCompleted === w.isLessonCompleted && ids.includes(p.lessonId))
        .map((p) => ({ lessonId: p.lessonId }));
      return rows as unknown as E[];
    }
    throw new Error('unexpected entity');
  }
  const manager = { find };
  return { manager, calls };
}

const done = (...ids: string[]): ProgressRow[] =>
  ids.map((lessonId) => ({ userId: STUDENT.id, lessonId, isLessonCompleted: true }));

function rejectsWith(status: number, error?: string) {
  return (err: unknown) => {
    assert.ok(err instanceof AppError, `expected AppError, got ${String(err)}`);
    assert.equal(err.getStatus(), status);
    if (error) assert.equal((err.getResponse() as { error: string }).error, error);
    return true;
  };
}

describe('getLessonCompletion() — the single server rule', () => {
  it('no published lessons → never complete', async () => {
    const { manager } = fakeManager([{ id: 'L9', courseId: COURSE_ID, isPublished: false, lessonOrder: 1 }], []);
    assert.deepEqual(await getLessonCompletion(manager, STUDENT.id, COURSE_ID), { total: 0, done: 0, complete: false });
  });

  it('only published lessons count; the unpublished one is not required', async () => {
    const { manager } = fakeManager(lessons(), done('L1', 'L2'));
    assert.deepEqual(await getLessonCompletion(manager, STUDENT.id, COURSE_ID), { total: 2, done: 2, complete: true });
  });

  it('partial progress → not complete; a not-completed row does not count', async () => {
    const rows: ProgressRow[] = [...done('L1'), { userId: STUDENT.id, lessonId: 'L2', isLessonCompleted: false }];
    const { manager } = fakeManager(lessons(), rows);
    assert.deepEqual(await getLessonCompletion(manager, STUDENT.id, COURSE_ID), { total: 2, done: 1, complete: false });
  });

  it('queries published lessons and completed lesson_progress rows only', async () => {
    const { manager, calls } = fakeManager(lessons(), done('L1', 'L2'));
    await getLessonCompletion(manager, STUDENT.id, COURSE_ID);
    assert.equal(calls.find[0].entity, Lesson);
    assert.equal(calls.find[0].where.isPublished, true);
    assert.equal(calls.find[1].entity, LessonProgress);
    assert.equal(calls.find[1].where.isLessonCompleted, true);
    assert.deepEqual(opValue(calls.find[1].where.lessonId), ['L1', 'L2']);
  });
});

/** ProgressService with in-memory repositories. Nothing here can write: any write path throws. */
function progressSetup(opts: {
  progress: ProgressRow[];
  canWatch?: boolean;
  enrollmentCompletedAt?: Date | null;
  courseProgressIsCompleted?: boolean;
  certificate?: object | null;
  bestAttempt?: { score: number; passed: boolean } | null;
  lessonRows?: LessonRow[];
}) {
  const lessonRows = opts.lessonRows ?? lessons();
  const { manager, calls: emCalls } = fakeManager(lessonRows, opts.progress);
  const calls = { transaction: 0, writes: 0, testWhere: [] as Record<string, unknown>[], certificateSaves: 0 };
  const forbidden = async () => {
    calls.writes += 1;
    throw new Error('write not expected');
  };

  const lessonsRepo = {
    find: async (o: { where: Record<string, unknown> }) =>
      lessonRows
        .filter((l) => l.courseId === o.where.courseId && l.isPublished === o.where.isPublished)
        .sort((a, b) => a.lessonOrder - b.lessonOrder)
        .map((l) => ({ id: l.id, lessonOrder: l.lessonOrder })),
  };
  const enrollments = {
    findOne: async () => ({ enrolledAt: new Date('2026-01-01T00:00:00Z'), completedAt: opts.enrollmentCompletedAt ?? null, status: 'active' }),
    update: forbidden,
  };
  const courseProgress = {
    findOne: async () => ({ isCompleted: opts.courseProgressIsCompleted ?? false, progressPercent: 100 }),
    update: forbidden,
    save: forbidden,
  };
  const lessonProgress = {
    // get(): completed rows of published lessons of the course
    find: async () =>
      opts.progress
        .filter((p) => p.isLessonCompleted && lessonRows.some((l) => l.id === p.lessonId && l.isPublished))
        .map((p) => ({ lessonId: p.lessonId })),
    save: forbidden,
    update: forbidden,
  };
  const tests = {
    findOne: async (o: { where: Record<string, unknown> }) => {
      calls.testWhere.push(o.where);
      return { id: 'T1', passingScore: 90 };
    },
  };
  const attempts = { findOne: async () => opts.bestAttempt ?? null };
  const certificates = {
    findOne: async (o: { where: Record<string, unknown> }) => {
      if (o.where.certificateNumber) return null; // no number clash
      if (o.where.id) return null; // the service then answers with the saved row
      return opts.certificate ?? null;
    },
    create: (row: object) => row,
    save: async (row: object) => {
      calls.certificateSaves += 1;
      return { ...row, id: 'CERT-NEW', issuedAt: new Date('2026-01-02T00:00:00Z') };
    },
  };
  const ds = {
    manager,
    transaction: async () => {
      calls.transaction += 1;
      throw new Error('transaction not expected');
    },
  };
  const courses = {
    resolveId: async () => COURSE_ID,
    userCanWatchPaidCourse: async () => opts.canWatch ?? true,
  };
  const service = new ProgressService(
    lessonsRepo as never,
    enrollments as never,
    courseProgress as never,
    lessonProgress as never,
    tests as never,
    attempts as never,
    certificates as never,
    ds as never,
    courses as never,
  );
  return { service, calls, emCalls };
}

describe('POST progress/sync — read-only, client data is never trusted', () => {
  const bodies: [string, unknown][] = [
    ['the last lesson id', { completedLessonIds: ['L2'] }],
    ['N arbitrary strings', { completedLessonIds: ['x', 'y', 'z'] }],
    ['an unpublished lesson id', { completedLessonIds: ['L3'] }],
    ['a lesson id of another course', { completedLessonIds: ['OTHER'] }],
    ['a non-array', { completedLessonIds: 'L2' }],
    ['an empty body', undefined],
  ];
  for (const [label, body] of bodies) {
    it(`${label} → only server-confirmed lessons, nothing written`, async () => {
      const { service, calls } = progressSetup({ progress: done('L1') });
      const res = await service.sync(STUDENT, COURSE_ID, body);
      assert.deepEqual(res, { completedLessonIds: ['L1'] });
      assert.equal(calls.transaction, 0, 'sync opened a write transaction');
      assert.equal(calls.writes, 0, 'sync wrote progress');
    });
  }

  it('no access to the course → 403, as before', async () => {
    const { service, calls } = progressSetup({ progress: [], canWatch: false });
    await assert.rejects(service.sync(STUDENT, COURSE_ID, { completedLessonIds: ['L2'] }), rejectsWith(403, 'Курс ачыла элек'));
    assert.equal(calls.transaction, 0);
  });

  it('an admin token → 403 (user accounts only), as before', async () => {
    const { service } = progressSetup({ progress: [] });
    await assert.rejects(service.sync(ADMIN, COURSE_ID, {}), rejectsWith(403));
  });
});

describe('GET progress — isCompleted is computed from lesson_progress', () => {
  it('old enrollments.completed_at and course_progress.is_completed do not make it complete', async () => {
    const { service } = progressSetup({
      progress: done('L1'),
      enrollmentCompletedAt: new Date('2025-01-01T00:00:00Z'),
      courseProgressIsCompleted: true,
    });
    const res = await service.get(STUDENT, COURSE_ID);
    assert.equal(res.isCompleted, false);
    assert.deepEqual(res.completedLessonIds, ['L1']);
  });

  it('every published lesson completed → isCompleted true', async () => {
    const { service } = progressSetup({ progress: done('L1', 'L2') });
    assert.equal((await service.get(STUDENT, COURSE_ID)).isCompleted, true);
  });

  it('the final test is looked up the same way as the exam (course-level: lessonId IS NULL)', async () => {
    const { service, calls } = progressSetup({ progress: [] });
    await service.get(STUDENT, COURSE_ID);
    assert.equal(opType(calls.testWhere[0].lessonId), 'isNull');
  });
});

describe('POST progress/certificate — same rule for a new certificate', () => {
  it('an existing certificate is returned unchanged (no lesson check)', async () => {
    const existing = { id: 'CERT-OLD', certificateNumber: 'MA-1', verificationCode: 'v', recipientName: 'A', issuedAt: new Date('2025-05-05T00:00:00Z'), courseId: COURSE_ID, course: { title: 'Course' } };
    const { service, emCalls } = progressSetup({ progress: [], certificate: existing });
    const res = await service.issueCertificate(STUDENT, COURSE_ID, {});
    assert.equal(res.id, 'CERT-OLD');
    assert.equal(emCalls.find.length, 0);
  });

  it('no published lessons → 400 "Курс сабактары жок"', async () => {
    const { service } = progressSetup({ progress: [], lessonRows: [{ id: 'L9', courseId: COURSE_ID, isPublished: false, lessonOrder: 1 }] });
    await assert.rejects(service.issueCertificate(STUDENT, COURSE_ID, {}), rejectsWith(400, 'Курс сабактары жок'));
  });

  it('an old completed_at without lesson_progress rows → 400, no certificate', async () => {
    const { service, calls } = progressSetup({
      progress: done('L1'),
      enrollmentCompletedAt: new Date('2025-01-01T00:00:00Z'),
      courseProgressIsCompleted: true,
      bestAttempt: { score: 100, passed: true },
    });
    await assert.rejects(service.issueCertificate(STUDENT, COURSE_ID, {}), rejectsWith(400, 'Бардык сабактарды бүтүрүңүз'));
    assert.equal(calls.certificateSaves, 0);
  });

  it('lessons complete but best score below 90 → 400', async () => {
    const { service, calls } = progressSetup({ progress: done('L1', 'L2'), bestAttempt: { score: 89, passed: true } });
    await assert.rejects(service.issueCertificate(STUDENT, COURSE_ID, {}), rejectsWith(400));
    assert.equal(calls.certificateSaves, 0);
    assert.equal(opType(calls.testWhere[0].lessonId), 'isNull');
  });

  it('lessons complete and score ≥ 90 → a certificate is created', async () => {
    const { service, calls } = progressSetup({ progress: done('L1', 'L2'), bestAttempt: { score: 90, passed: true } });
    const res = await service.issueCertificate(STUDENT, COURSE_ID, { studentName: 'Test' });
    assert.equal(calls.certificateSaves, 1);
    assert.equal(res.id, 'CERT-NEW');
  });
});

const PAID = { id: COURSE_ID, courseType: 'paid' as const };
const LOCK = { locked: false, lockedUntil: null, remainingAttempts: 3, failedInWindow: 0 };
const QUESTION_TEXT = 'SECRET-QUESTION-TEXT-Тавхид';
const SERVICE_TEST = {
  id: 'T1',
  title: 'Final',
  passingScore: 90,
  questions: [{ id: 'Q1', questionType: 'choice', questionText: QUESTION_TEXT, options: [{ id: 'O1', optionText: 'OPTION-TEXT', optionOrder: 1, label: 'А' }] }],
  ...LOCK,
};
const ANSWERS = [{ questionId: '11111111-1111-4111-8111-111111111111', selectedOptionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }];

function controllerSetup(opts: { course?: typeof PAID | { id: string; courseType: 'free' } | null; progress: ProgressRow[]; canWatch?: boolean; serviceThrows?: AppError }) {
  const { manager, calls: emCalls } = fakeManager(lessons(), opts.progress);
  const calls = { getFinalTest: 0, gradeFinalTest: 0, canWatch: 0 };
  const tests = {
    getFinalTest: async () => {
      calls.getFinalTest += 1;
      if (opts.serviceThrows) throw opts.serviceThrows;
      return SERVICE_TEST;
    },
    gradeFinalTest: async () => {
      calls.gradeFinalTest += 1;
      return { scorePercent: 100, passed: true, total: 1, correct: 1, ...LOCK };
    },
  };
  const courses = {
    resolveRef: async () => (opts.course === undefined ? PAID : opts.course),
    userCanWatchPaidCourse: async () => {
      calls.canWatch += 1;
      return opts.canWatch ?? true;
    },
  };
  const controller = new TestsController(tests as never, courses as never, { manager } as never);
  return { controller, calls, emCalls };
}

describe('GET final-test — no questions until every published lesson is completed', () => {
  it('student with partial progress → metadata only, no question or option text', async () => {
    const { controller, calls } = controllerSetup({ progress: done('L1') });
    const res = await controller.finalTest(COURSE_ID, STUDENT);
    assert.equal(calls.getFinalTest, 1, 'access is checked by the service first');
    assert.deepEqual(res, {
      id: 'T1',
      title: 'Final',
      passingScore: 90,
      ...LOCK,
      questions: [],
      lessonsComplete: false,
      lessonsRequired: { total: 2, done: 1 },
    });
    const json = JSON.stringify(res);
    for (const leaked of [QUESTION_TEXT, 'OPTION-TEXT', 'Q1', 'O1']) assert.ok(!json.includes(leaked), `leaked ${leaked}`);
  });

  it('student with every published lesson completed → the service answer unchanged', async () => {
    const { controller } = controllerSetup({ progress: done('L1', 'L2') });
    assert.deepEqual(await controller.finalTest(COURSE_ID, STUDENT), SERVICE_TEST);
  });

  it('a student without access → the service 403 propagates, lessons are never read', async () => {
    const { controller, emCalls } = controllerSetup({ progress: [], serviceThrows: new AppError(403, 'Курс ачыла элек') });
    await assert.rejects(controller.finalTest(COURSE_ID, STUDENT), rejectsWith(403, 'Курс ачыла элек'));
    assert.equal(emCalls.find.length, 0);
  });

  for (const [label, user] of [['an admin', ADMIN], ['an anonymous visitor', undefined]] as const) {
    it(`${label} → previous behaviour (service answer), lessons are never read`, async () => {
      const { controller, emCalls } = controllerSetup({ progress: [] });
      assert.deepEqual(await controller.finalTest(COURSE_ID, user), SERVICE_TEST);
      assert.equal(emCalls.find.length, 0);
    });
  }

  it('a free course → 404 before the service or the lesson check', async () => {
    const { controller, calls, emCalls } = controllerSetup({ course: { id: COURSE_ID, courseType: 'free' }, progress: [] });
    await assert.rejects(controller.finalTest(COURSE_ID, STUDENT), rejectsWith(404, 'Тест табылган жок'));
    assert.equal(calls.getFinalTest, 0);
    assert.equal(emCalls.find.length, 0);
  });
});

describe('POST final-test/grade — no grading and no saved attempt before the lessons', () => {
  it('partial progress → 403 LESSONS_INCOMPLETE, gradeFinalTest (the only attempt writer) not called', async () => {
    const { controller, calls } = controllerSetup({ progress: done('L1') });
    await assert.rejects(controller.grade(COURSE_ID, STUDENT, { answers: ANSWERS }), (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.getStatus(), 403);
      assert.deepEqual(err.getResponse(), { error: 'Бардык сабактарды бүтүрүңүз', code: 'LESSONS_INCOMPLETE', total: 2, done: 1 });
      return true;
    });
    assert.equal(calls.gradeFinalTest, 0);
  });

  it('no access → 403 "Курс ачыла элек" before anything about the lessons is read', async () => {
    const { controller, calls, emCalls } = controllerSetup({ progress: done('L1', 'L2'), canWatch: false });
    await assert.rejects(controller.grade(COURSE_ID, STUDENT, { answers: ANSWERS }), rejectsWith(403, 'Курс ачыла элек'));
    assert.equal(emCalls.find.length, 0);
    assert.equal(calls.gradeFinalTest, 0);
  });

  it('every published lesson completed → graded, student result only (H-1 kept)', async () => {
    const { controller, calls } = controllerSetup({ progress: done('L1', 'L2') });
    const res = await controller.grade(COURSE_ID, STUDENT, { answers: ANSWERS });
    assert.equal(calls.gradeFinalTest, 1);
    assert.equal(res.scorePercent, 100);
    assert.ok(!('correct' in res), 'correct-answer count must stay hidden (H-1)');
  });

  it('no user or an admin → 403 from the role check before the course or the lessons', async () => {
    for (const user of [undefined, ADMIN]) {
      const { controller, calls, emCalls } = controllerSetup({ progress: done('L1', 'L2') });
      await assert.rejects(controller.grade(COURSE_ID, user, { answers: ANSWERS }), rejectsWith(403));
      assert.equal(calls.canWatch, 0);
      assert.equal(emCalls.find.length, 0);
      assert.equal(calls.gradeFinalTest, 0);
    }
  });

  it('a free course → 404, nothing else checked', async () => {
    const { controller, calls, emCalls } = controllerSetup({ course: { id: COURSE_ID, courseType: 'free' }, progress: [] });
    await assert.rejects(controller.grade(COURSE_ID, STUDENT, { answers: ANSWERS }), rejectsWith(404, 'Тест табылган жок'));
    assert.equal(calls.canWatch, 0);
    assert.equal(emCalls.find.length, 0);
  });

  it('an unknown course → left to the service (previous errors)', async () => {
    const { controller, calls } = controllerSetup({ course: null, progress: [] });
    await controller.grade('missing', STUDENT, { answers: ANSWERS });
    assert.equal(calls.gradeFinalTest, 1);
    assert.equal(calls.canWatch, 0);
  });
});
