/**
 * Final exams exist only for paid courses: for a free course TestsController refuses the
 * student exam API (404) and the creation of a new final test (400) before TestsService is
 * reached. Paid and unknown courses go to the service exactly as before.
 *
 * Run (no database — TestsService and CoursesService are mocks):
 *   node --import tsx --test server/test/final-test-free-course.test.ts
 *
 * Kept outside server/src so it is not part of the Nest build output.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AppError } from '../src/common/app-error';
import { AdminGuard, JwtAuthGuard, OptionalAuthGuard, type AuthUser } from '../src/common/auth';
import { TestsController } from '../src/tests/tests.controller';

const STUDENT: AuthUser = { id: '33333333-3333-4333-8333-333333333333', role: 'user' } as AuthUser;
const ADMIN: AuthUser = { id: '44444444-4444-4444-8444-444444444444', role: 'admin' } as AuthUser;
const ANSWERS = [{ questionId: '11111111-1111-4111-8111-111111111111', selectedOptionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }];
const CREATE_BODY = { courseRef: 'some-course', questions: [] } as never;

const PUBLIC_TEST = { id: 't1', title: 'Final', passingScore: 90, questions: [{ id: 'q1', questionText: 'Q?' }] };
const GRADED = { scorePercent: 50, passed: false, total: 2, correct: 1, locked: false, lockedUntil: null };

type Course = { courseType: 'free' | 'paid' } | null;

function setup(course: Course) {
  const calls = { resolveRef: [] as string[], getFinalTest: 0, gradeFinalTest: 0, adminCreate: 0 };
  const tests = {
    getFinalTest: async () => {
      calls.getFinalTest += 1;
      return PUBLIC_TEST;
    },
    gradeFinalTest: async () => {
      calls.gradeFinalTest += 1;
      return GRADED;
    },
    adminCreate: async () => {
      calls.adminCreate += 1;
      return { test: { id: 't-new' } };
    },
  };
  const courses = {
    resolveRef: async (ref: string) => {
      calls.resolveRef.push(ref);
      return course;
    },
  };
  return { controller: new TestsController(tests as never, courses as never), calls };
}

function status(code: number, message?: string) {
  return (err: unknown) => {
    assert.ok(err instanceof AppError, `expected AppError, got ${String(err)}`);
    assert.equal(err.getStatus(), code);
    if (message) assert.deepEqual(err.getResponse(), { error: message });
    return true;
  };
}

const FREE = { courseType: 'free' } as const;
const PAID = { courseType: 'paid' } as const;

describe('GET /courses/:courseRef/final-test', () => {
  it('1: free course → 404 "Тест табылган жок", questions are not loaded', async () => {
    for (const user of [undefined, STUDENT, ADMIN]) {
      const { controller, calls } = setup(FREE);
      await assert.rejects(controller.finalTest('free-bayanlar', user), status(404, 'Тест табылган жок'));
      assert.deepEqual(calls.resolveRef, ['free-bayanlar']);
      assert.equal(calls.getFinalTest, 0);
    }
  });

  it('2: paid course → the service is called and its answer is returned unchanged', async () => {
    const { controller, calls } = setup(PAID);
    assert.deepEqual(await controller.finalTest('paid-course', STUDENT), PUBLIC_TEST);
    assert.equal(calls.getFinalTest, 1);
  });
});

describe('POST /courses/:courseRef/final-test/grade', () => {
  it('3: free course → 404, gradeFinalTest is not called', async () => {
    const { controller, calls } = setup(FREE);
    await assert.rejects(controller.grade('free-bayanlar', STUDENT, { answers: ANSWERS }), status(404, 'Тест табылган жок'));
    assert.equal(calls.gradeFinalTest, 0);
  });

  it('4: paid course → the service grades it, the student result is returned as before', async () => {
    const { controller, calls } = setup(PAID);
    const body = await controller.grade('paid-course', STUDENT, { answers: ANSWERS });
    assert.equal(calls.gradeFinalTest, 1);
    assert.equal(body.scorePercent, 50);
    assert.equal(body.passed, false);
    assert.equal(body.total, 2);
    assert.ok(!('correct' in body), 'correct-answer count must stay hidden (H-1)');
  });
});

describe('POST /admin/tests', () => {
  it('5: free course → 400, adminCreate is not called', async () => {
    const { controller, calls } = setup(FREE);
    await assert.rejects(controller.adminCreate(CREATE_BODY), status(400));
    assert.deepEqual(calls.resolveRef, ['some-course']);
    assert.equal(calls.adminCreate, 0);
  });

  it('6: paid course → the request goes to the service unchanged', async () => {
    const { controller, calls } = setup(PAID);
    assert.deepEqual(await controller.adminCreate(CREATE_BODY), { test: { id: 't-new' } });
    assert.equal(calls.adminCreate, 1);
  });
});

describe('7: unknown course keeps the previous behaviour (left to the service)', () => {
  it('GET, POST grade and admin create all reach the service', async () => {
    const { controller, calls } = setup(null);
    await controller.finalTest('missing', undefined);
    await controller.grade('missing', STUDENT, { answers: ANSWERS });
    await controller.adminCreate(CREATE_BODY);
    assert.equal(calls.getFinalTest, 1);
    assert.equal(calls.gradeFinalTest, 1);
    assert.equal(calls.adminCreate, 1);
  });
});

describe('8: authorization and role checks are not bypassed', () => {
  for (const [label, course] of [
    ['free', FREE],
    ['paid', PAID],
  ] as const) {
    it(`grade: no user or an admin → 403 before the course lookup (${label} course)`, async () => {
      for (const user of [undefined, ADMIN]) {
        const { controller, calls } = setup(course);
        await assert.rejects(controller.grade('course', user, { answers: ANSWERS }), status(403));
        assert.deepEqual(calls.resolveRef, []);
        assert.equal(calls.gradeFinalTest, 0);
      }
    });
  }

  it('route guards are unchanged', () => {
    const guards = (name: keyof TestsController) =>
      Reflect.getMetadata(GUARDS_METADATA, TestsController.prototype[name]) as unknown[];
    assert.deepEqual(guards('finalTest'), [OptionalAuthGuard]);
    assert.deepEqual(guards('grade'), [JwtAuthGuard]);
    for (const name of ['adminList', 'adminGet', 'adminCreate', 'adminUpdate', 'adminDelete'] as const) {
      assert.deepEqual(guards(name), [AdminGuard], name);
    }
  });
});
