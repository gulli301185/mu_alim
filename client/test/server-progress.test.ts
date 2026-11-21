/**
 * QA H-2 client (C1, C4): server-confirmed progress, exam availability, certificate readiness.
 * Pure module only — no network, no localStorage, no Vite.
 *
 * Run: node --import tsx --test client/test/server-progress.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CourseLesson } from '../src/data/courseLessons';
import {
  confirmedLessonIds,
  isCertificateReadyFromServer,
  isFinalTestAvailable,
  unconfirmedLessonIds,
} from '../src/lib/server-progress';

const lesson = (id: string, order: number): CourseLesson => ({ id, order, title: id, duration: '—', videoId: null });
// unsorted on purpose; L3 has a gap before it (no lesson 3)
const LESSONS = [lesson('L4', 4), lesson('L1', 1), lesson('L2', 2)];

describe('confirmedLessonIds (C1)', () => {
  it('only lessons the server confirmed, in course order', () => {
    assert.deepEqual(confirmedLessonIds(LESSONS, ['L4', 'L1']), ['L1', 'L4']);
  });

  it('never widens: the highest lesson does not confirm the earlier ones', () => {
    assert.deepEqual(confirmedLessonIds(LESSONS, ['L4']), ['L4']);
  });

  it('ids of other courses / unpublished lessons are dropped', () => {
    assert.deepEqual(confirmedLessonIds(LESSONS, ['X9', 'L2', 'old-local-id']), ['L2']);
  });

  it('nothing from the server → nothing confirmed', () => {
    assert.deepEqual(confirmedLessonIds(LESSONS, []), []);
  });
});

describe('unconfirmedLessonIds (C1, display only)', () => {
  it('local ids the server does not have, in course order', () => {
    assert.deepEqual(unconfirmedLessonIds(LESSONS, ['L2', 'L1', 'L4'], ['L1']), ['L2', 'L4']);
  });

  it('local ids of lessons no longer in the course are ignored', () => {
    assert.deepEqual(unconfirmedLessonIds(LESSONS, ['gone', 'L2'], []), ['L2']);
  });

  it('everything confirmed → none', () => {
    assert.deepEqual(unconfirmedLessonIds(LESSONS, ['L1'], ['L1', 'L2']), []);
  });
});

describe('isFinalTestAvailable (C4)', () => {
  const q = [{ id: 'q1' }];
  it('lessonsComplete: false closes the exam even with questions', () => {
    assert.equal(isFinalTestAvailable({ lessonsComplete: false, questions: q }), false);
  });
  it('lessonsComplete: true with questions → open', () => {
    assert.equal(isFinalTestAvailable({ lessonsComplete: true, questions: q }), true);
  });
  it('older server (no field): open only with questions', () => {
    assert.equal(isFinalTestAvailable({ questions: q }), true);
    assert.equal(isFinalTestAvailable({ questions: [] }), false);
  });
  it('no test (null / undefined) → closed', () => {
    assert.equal(isFinalTestAvailable(null), false);
    assert.equal(isFinalTestAvailable(undefined), false);
  });
  it('lessonsComplete: true but no questions → closed (never an empty exam)', () => {
    assert.equal(isFinalTestAvailable({ lessonsComplete: true, questions: [] }), false);
  });
});

describe('isCertificateReadyFromServer (C1)', () => {
  const base = {
    hasIssuedCertificate: false,
    hasFinalTest: true,
    allLessonsConfirmed: true,
    finalTestPassed: true,
    finalTestScore: 90,
    passScore: 90,
  };
  it('a certificate already issued by the server is always downloadable', () => {
    assert.equal(
      isCertificateReadyFromServer({ ...base, hasIssuedCertificate: true, allLessonsConfirmed: false, finalTestPassed: false, finalTestScore: 0 }),
      true,
    );
  });
  it('new certificate: confirmed lessons + final test + passed at ≥ passScore', () => {
    assert.equal(isCertificateReadyFromServer(base), true);
  });
  it('new certificate refused when any condition is missing', () => {
    assert.equal(isCertificateReadyFromServer({ ...base, allLessonsConfirmed: false }), false);
    assert.equal(isCertificateReadyFromServer({ ...base, hasFinalTest: false }), false);
    assert.equal(isCertificateReadyFromServer({ ...base, finalTestPassed: false }), false);
    assert.equal(isCertificateReadyFromServer({ ...base, finalTestScore: 89 }), false);
    assert.equal(isCertificateReadyFromServer({ ...base, finalTestScore: undefined }), false);
  });
});
