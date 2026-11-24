/**
 * E1 — lesson duration rules on the server (no database: repositories and services are mocked).
 *
 * - durationSeconds is an integer 1..21600; `undefined` (not sent) differs from `null` (cleared).
 * - A newly published lesson needs a duration (400 DURATION_REQUIRED); a bad value → 400 DURATION_INVALID.
 * - Older lessons published without a duration stay editable and get `warnings: ['DURATION_MISSING']`
 *   on the admin PUT response only; the admin form re-sending `isPublished: true` is not a new publication.
 * - Nothing is saved, and `existing` is untouched, when a check fails.
 *
 * Run (from server/): node --import tsx --test test/lesson-duration.test.ts
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { translateErrorBody, translateMessage } from '../src/common/i18n';
import {
  DURATION_INVALID_MESSAGE,
  DURATION_REQUIRED_MESSAGE,
  MAX_LESSON_DURATION_SECONDS,
  assertPublishable,
  evaluatePublishState,
  isValidDuration,
  parseDurationField,
  type PublishChanges,
  type PublishCheck,
  type PublishState,
} from '../src/lessons/lesson-duration';
import { LessonsService } from '../src/lessons/lessons.service';

const PUB_600: PublishState = { isPublished: true, durationSeconds: 600 };
const PUB_NULL: PublishState = { isPublished: true, durationSeconds: null };
const UNPUB_NULL: PublishState = { isPublished: false, durationSeconds: null };
const UNPUB_600: PublishState = { isPublished: false, durationSeconds: 600 };

function errorOf(fn: () => unknown): { status: number; body: Record<string, unknown> } {
  try {
    fn();
  } catch (err) {
    const e = err as { getStatus: () => number; getResponse: () => Record<string, unknown> };
    return { status: e.getStatus(), body: e.getResponse() };
  }
  throw new Error('expected an error');
}

describe('isValidDuration / parseDurationField (R1, C1b, C4)', () => {
  it('accepts integers 1..21600', () => {
    for (const v of [1, 600, MAX_LESSON_DURATION_SECONDS]) assert.equal(isValidDuration(v), true, String(v));
  });

  it('rejects 0, negatives, fractions, > 21600, NaN, Infinity, strings, null, booleans', () => {
    for (const v of [0, -1, -600, 1.5, 21_601, Number.NaN, Number.POSITIVE_INFINITY, '600', null, true, {}]) {
      assert.equal(isValidDuration(v), false, String(v));
    }
  });

  it('undefined = not sent; null = clear (update only); anything else invalid → 400 DURATION_INVALID', () => {
    assert.equal(parseDurationField(undefined, { allowNull: true }), undefined);
    assert.equal(parseDurationField(undefined, { allowNull: false }), undefined);
    assert.equal(parseDurationField(null, { allowNull: true }), null);
    assert.equal(parseDurationField(600, { allowNull: false }), 600);
    for (const v of [null, 0, -5, 1.5, 21_601, '600', Number.NaN, Number.POSITIVE_INFINITY]) {
      const { status, body } = errorOf(() => parseDurationField(v, { allowNull: v !== null ? true : false }));
      assert.equal(status, 400, String(v));
      assert.equal(body.code, 'DURATION_INVALID', String(v));
      assert.equal(body.error, DURATION_INVALID_MESSAGE);
    }
  });
});

describe('evaluatePublishState — approved scenarios', () => {
  const cases: [string, PublishState | null, PublishChanges, PublishCheck][] = [
    ['R1c published with a valid duration', PUB_600, { durationSeconds: 1 }, 'ok'],
    ['R2 clear duration of a published lesson', PUB_600, { durationSeconds: null }, 'DURATION_REQUIRED'],
    ['R2 same, form re-sends isPublished:true', PUB_600, { durationSeconds: null, isPublished: true }, 'DURATION_REQUIRED'],
    ['R2b clear + unpublish', PUB_600, { durationSeconds: null, isPublished: false }, 'ok'],
    ['R2c older lesson, null sent again (no change)', PUB_NULL, { durationSeconds: null }, 'DURATION_MISSING'],
    ['R3 newly publish without duration', UNPUB_NULL, { isPublished: true }, 'DURATION_REQUIRED'],
    ['R3b clear + newly publish', UNPUB_600, { durationSeconds: null, isPublished: true }, 'DURATION_REQUIRED'],
    ['R4 older lesson, title only', PUB_NULL, {}, 'DURATION_MISSING'],
    ['R4b older lesson, form re-sends isPublished:true', PUB_NULL, { isPublished: true }, 'DURATION_MISSING'],
    ['R5 duration and publish together', UNPUB_NULL, { durationSeconds: 600, isPublished: true }, 'ok'],
    ['R5b older lesson gets a duration', PUB_NULL, { durationSeconds: 600 }, 'ok'],
    ['R6 older lesson unpublished', PUB_NULL, { isPublished: false }, 'ok'],
    ['R7 unpublished lesson, clear duration', UNPUB_NULL, { durationSeconds: null }, 'ok'],
    ['unpublished lesson, unrelated edit', UNPUB_NULL, {}, 'ok'],
    ['C1 new lesson, published, no duration', null, { isPublished: true, durationSeconds: null }, 'DURATION_REQUIRED'],
    ['C2 new lesson, unpublished, no duration', null, { isPublished: false, durationSeconds: null }, 'ok'],
    ['C3 new lesson, published with duration', null, { isPublished: true, durationSeconds: 600 }, 'ok'],
  ];
  for (const [label, existing, changes, expected] of cases) {
    it(label, () => {
      const before = existing ? { ...existing } : null;
      assert.equal(evaluatePublishState(existing, changes), expected);
      assert.deepEqual(existing, before, 'existing is not mutated');
    });
  }

  it('assertPublishable throws 400 DURATION_REQUIRED or returns the warnings', () => {
    const { status, body } = errorOf(() => assertPublishable(UNPUB_NULL, { isPublished: true }));
    assert.equal(status, 400);
    assert.equal(body.code, 'DURATION_REQUIRED');
    assert.equal(body.error, DURATION_REQUIRED_MESSAGE);
    assert.deepEqual(assertPublishable(PUB_NULL, {}), ['DURATION_MISSING']);
    assert.deepEqual(assertPublishable(PUB_600, {}), []);
  });
});

describe('KG/RU messages and the error body keep `code`', () => {
  it('both messages have a Russian translation', () => {
    assert.equal(translateMessage(DURATION_REQUIRED_MESSAGE, 'ru'), 'Чтобы опубликовать урок, укажите длительность видео');
    assert.equal(
      translateMessage(DURATION_INVALID_MESSAGE, 'ru'),
      'Длительность должна быть целым числом от 1 секунды до 6 часов',
    );
    assert.equal(translateMessage(DURATION_REQUIRED_MESSAGE, 'kg'), DURATION_REQUIRED_MESSAGE);
  });

  it('translateErrorBody (used by the global exception filter) keeps `code` and translates `error`', () => {
    const { body } = errorOf(() => assertPublishable(null, { isPublished: true, durationSeconds: null }));
    const ru = translateErrorBody(body, 'ru');
    assert.equal(ru.code, 'DURATION_REQUIRED');
    assert.equal(ru.error, 'Чтобы опубликовать урок, укажите длительность видео');
    const kg = translateErrorBody(body, 'kg');
    assert.equal(kg.code, 'DURATION_REQUIRED');
    assert.equal(kg.error, DURATION_REQUIRED_MESSAGE);
  });
});

/* ── LessonsService with mocked repositories (no database) ─────────────────────────── */

type Row = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
  youtubeVideoId: string;
  durationSeconds: number | null;
  lessonOrder: number;
  isPublished: boolean;
};

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

function row(over: Partial<Row> = {}): Row {
  return {
    id: 'lesson-1',
    courseId: 'course-1',
    title: 'Lesson',
    description: null,
    youtubeUrl: VIDEO_URL,
    youtubeVideoId: 'dQw4w9WgXcQ',
    durationSeconds: 600,
    lessonOrder: 1,
    isPublished: true,
    ...over,
  };
}

function serviceWith(existing: Row | null, listRows: Row[] = []) {
  const calls = { saves: 0 };
  const lessonRepo = {
    findOneBy: async () => existing,
    findOne: async () => null,
    find: async () => listRows,
    create: (value: object) => ({ id: 'new-lesson', ...value }),
    save: async (value: object) => {
      calls.saves += 1;
      return value;
    },
  };
  const courseRepo = { findOne: async () => ({ id: 'course-1', courseType: 'paid' }) };
  const cache = { wrap: async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn() };
  const courses = {
    resolveId: async () => 'course-1',
    invalidate: async () => {},
    userCanWatchPaidCourse: async () => false,
  };
  const service = new LessonsService(lessonRepo as never, courseRepo as never, cache as never, courses as never);
  return { service, calls };
}

async function statusAndCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    const e = err as { getStatus: () => number; getResponse: () => { code?: string } };
    return { status: e.getStatus(), code: e.getResponse().code };
  }
  throw new Error('expected the call to fail');
}

describe('LessonsService.update — rules applied before save, existing untouched on error', () => {
  const refused: [string, Partial<Row>, Record<string, unknown>, string][] = [
    ['R1a duration 0', {}, { durationSeconds: 0 }, 'DURATION_INVALID'],
    ['R1a negative', {}, { durationSeconds: -5 }, 'DURATION_INVALID'],
    ['R1a fraction', {}, { durationSeconds: 1.5 }, 'DURATION_INVALID'],
    ['R1a string', {}, { durationSeconds: '600' }, 'DURATION_INVALID'],
    ['R1b above 21600', {}, { durationSeconds: 21_601 }, 'DURATION_INVALID'],
    ['R2 clear duration of a published lesson', {}, { durationSeconds: null }, 'DURATION_REQUIRED'],
    ['R2 same with isPublished:true', {}, { durationSeconds: null, isPublished: true }, 'DURATION_REQUIRED'],
    ['R3 newly publish without duration', { isPublished: false, durationSeconds: null }, { isPublished: true }, 'DURATION_REQUIRED'],
    ['R3b clear + newly publish', { isPublished: false }, { durationSeconds: null, isPublished: true }, 'DURATION_REQUIRED'],
    ['R8 unpublished lesson, 21601', { isPublished: false }, { durationSeconds: 21_601 }, 'DURATION_INVALID'],
  ];
  for (const [label, state, body, code] of refused) {
    it(`${label} → 400 ${code}, no save`, async () => {
      const existing = row(state);
      const before = { ...existing };
      const { service, calls } = serviceWith(existing);
      assert.deepEqual(await statusAndCode(service.update('lesson-1', body as never)), { status: 400, code });
      assert.equal(calls.saves, 0);
      assert.deepEqual(existing, before, 'existing is unchanged');
    });
  }

  const accepted: [string, Partial<Row>, Record<string, unknown>, Partial<Row>, boolean][] = [
    ['R1c 1 second', {}, { durationSeconds: 1 }, { durationSeconds: 1 }, false],
    ['R1c 21600', {}, { durationSeconds: 21_600 }, { durationSeconds: 21_600 }, false],
    ['R2b clear + unpublish', {}, { durationSeconds: null, isPublished: false }, { durationSeconds: null, isPublished: false }, false],
    ['R2c older lesson, null sent again', { durationSeconds: null }, { durationSeconds: null, title: 'T2' }, { durationSeconds: null, title: 'T2' }, true],
    ['R4 older lesson, title', { durationSeconds: null }, { title: 'New title' }, { title: 'New title', isPublished: true }, true],
    ['R4b older lesson, form re-sends isPublished:true', { durationSeconds: null }, { title: 'T', isPublished: true, lessonOrder: 2 }, { title: 'T', lessonOrder: 2, isPublished: true }, true],
    ['R4c older lesson, description', { durationSeconds: null }, { description: 'D' }, { description: 'D' }, true],
    ['R5 duration + publish together', { isPublished: false, durationSeconds: null }, { durationSeconds: 600, isPublished: true }, { durationSeconds: 600, isPublished: true }, false],
    ['R5b older lesson gets a duration', { durationSeconds: null }, { durationSeconds: 900 }, { durationSeconds: 900 }, false],
    ['R6 older lesson unpublished', { durationSeconds: null }, { isPublished: false }, { isPublished: false }, false],
    ['R7 unpublished lesson, clear duration', { isPublished: false }, { durationSeconds: null }, { durationSeconds: null, isPublished: false }, false],
    ['duration not sent keeps the stored value', {}, { title: 'Only title' }, { durationSeconds: 600, title: 'Only title' }, false],
  ];
  for (const [label, state, body, expected, warn] of accepted) {
    it(`${label} → saved${warn ? ' + DURATION_MISSING' : ''}`, async () => {
      const { service, calls } = serviceWith(row(state));
      const result = (await service.update('lesson-1', body as never)) as Record<string, unknown>;
      assert.equal(calls.saves, 1);
      for (const [key, value] of Object.entries(expected)) assert.equal(result[key], value, key);
      if (warn) assert.deepEqual(result.warnings, ['DURATION_MISSING']);
      else assert.equal('warnings' in result, false);
    });
  }
});

describe('LessonsService.create', () => {
  const base = { title: 'New', youtubeUrl: VIDEO_URL, lessonOrder: 3 };
  const refused: [string, Record<string, unknown>, string][] = [
    ['C1 published (default) without duration', { ...base, isPublished: true }, 'DURATION_REQUIRED'],
    ['C1b durationSeconds: null', { ...base, isPublished: true, durationSeconds: null }, 'DURATION_INVALID'],
    ['C4 unpublished with 0', { ...base, isPublished: false, durationSeconds: 0 }, 'DURATION_INVALID'],
    ['above 21600', { ...base, isPublished: true, durationSeconds: 21_601 }, 'DURATION_INVALID'],
  ];
  for (const [label, body, code] of refused) {
    it(`${label} → 400 ${code}, no save`, async () => {
      const { service, calls } = serviceWith(null);
      assert.deepEqual(await statusAndCode(service.create('course-1', body as never)), { status: 400, code });
      assert.equal(calls.saves, 0);
    });
  }

  it('C2 unpublished without duration → saved with null, no warnings', async () => {
    const { service, calls } = serviceWith(null);
    const r = (await service.create('course-1', { ...base, isPublished: false } as never)) as Record<string, unknown>;
    assert.equal(calls.saves, 1);
    assert.equal(r.durationSeconds, null);
    assert.equal(r.isPublished, false);
    assert.equal('warnings' in r, false);
  });

  it('C3 published with 600 → saved, no warnings', async () => {
    const { service, calls } = serviceWith(null);
    const r = (await service.create('course-1', { ...base, isPublished: true, durationSeconds: 600 } as never)) as Record<
      string,
      unknown
    >;
    assert.equal(calls.saves, 1);
    assert.equal(r.durationSeconds, 600);
    assert.equal('warnings' in r, false);
  });
});

describe('student lesson list never carries `warnings`', () => {
  it('listForCourse DTOs have no warnings field, even for an older lesson without a duration', async () => {
    const { service } = serviceWith(null, [row({ durationSeconds: null }), row({ id: 'lesson-2', lessonOrder: 2 })]);
    const list = (await service.listForCourse('course-1', undefined)) as Record<string, unknown>[];
    assert.equal(list.length, 2);
    for (const dto of list) {
      assert.equal('warnings' in dto, false);
      assert.deepEqual(
        Object.keys(dto).sort(),
        ['description', 'durationSeconds', 'id', 'isPublished', 'lessonOrder', 'locked', 'title', 'youtubeVideoId'],
      );
    }
  });
});
