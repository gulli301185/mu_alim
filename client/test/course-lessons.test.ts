/**
 * Lesson unlock order: the previous lesson is the one before it in the published, sorted list —
 * gaps in the numbering do not lock lessons and the first published lesson is open whatever its
 * number. Pure module only — no network, no Vite.
 *
 * Run: node --import tsx --test client/test/course-lessons.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getFirstUnlockedLessonId,
  isLessonUnlocked,
  mapLessonsToCourseLessons,
  type CourseLesson,
} from '../src/data/courseLessons';
import type { LessonDto } from '../src/lib/lesson-api';

const lesson = (id: string, order: number): CourseLesson => ({ id, order, title: id, duration: '—', videoId: null });

describe('isLessonUnlocked', () => {
  it('regular sequence: first open, next opens after the previous one', () => {
    const seq = [lesson('L1', 1), lesson('L2', 2), lesson('L3', 3)];
    assert.equal(isLessonUnlocked(seq, 'L1', []), true);
    assert.equal(isLessonUnlocked(seq, 'L2', []), false);
    assert.equal(isLessonUnlocked(seq, 'L2', ['L1']), true);
    assert.equal(isLessonUnlocked(seq, 'L3', ['L1']), false);
  });

  it('gap in the numbering (no lesson 3): lesson 4 opens after lesson 2', () => {
    const withGap = [lesson('L1', 1), lesson('L2', 2), lesson('L4', 4)];
    assert.equal(isLessonUnlocked(withGap, 'L4', ['L1']), false);
    assert.equal(isLessonUnlocked(withGap, 'L4', ['L1', 'L2']), true);
  });

  it('first published lesson with number 5 is open', () => {
    const late = [lesson('L5', 5), lesson('L6', 6)];
    assert.equal(isLessonUnlocked(late, 'L5', []), true);
    assert.equal(isLessonUnlocked(late, 'L6', []), false);
    assert.equal(isLessonUnlocked(late, 'L6', ['L5']), true);
    assert.equal(getFirstUnlockedLessonId(late, []), 'L5');
  });

  it('works on an unsorted list', () => {
    const unsorted = [lesson('L4', 4), lesson('L1', 1), lesson('L2', 2)];
    assert.equal(isLessonUnlocked(unsorted, 'L1', []), true);
    assert.equal(isLessonUnlocked(unsorted, 'L4', ['L1', 'L2']), true);
  });

  it('unknown lesson or empty list → locked', () => {
    assert.equal(isLessonUnlocked([lesson('L1', 1)], 'nope', []), false);
    assert.equal(isLessonUnlocked([], 'L1', []), false);
    assert.equal(getFirstUnlockedLessonId([], []), null);
  });
});

describe('GAP course: GAP-L1, GAP-L2, unpublished GAP-L3, GAP-L4', () => {
  const dto = (id: string, lessonOrder: number, isPublished: boolean): LessonDto => ({
    id,
    title: id,
    youtubeVideoId: null,
    lessonOrder,
    isPublished,
  });
  const all = [dto('GAP-L1', 1, true), dto('GAP-L2', 2, true), dto('GAP-L3', 3, false), dto('GAP-L4', 4, true)];
  // The pages keep published lessons only before mapping (e.g. CourseDetailPage).
  const lessons = mapLessonsToCourseLessons(all.filter((l) => l.isPublished), '');

  it('the unpublished GAP-L3 is not part of the list', () => {
    assert.deepEqual(lessons.map((l) => l.id), ['GAP-L1', 'GAP-L2', 'GAP-L4']);
  });

  it('nothing completed: only GAP-L1 is open', () => {
    assert.equal(isLessonUnlocked(lessons, 'GAP-L1', []), true);
    assert.equal(isLessonUnlocked(lessons, 'GAP-L2', []), false);
    assert.equal(isLessonUnlocked(lessons, 'GAP-L4', []), false);
    assert.equal(getFirstUnlockedLessonId(lessons, []), 'GAP-L1');
  });

  it('GAP-L1 completed: GAP-L2 opens, GAP-L4 stays locked', () => {
    assert.equal(isLessonUnlocked(lessons, 'GAP-L2', ['GAP-L1']), true);
    assert.equal(isLessonUnlocked(lessons, 'GAP-L4', ['GAP-L1']), false);
  });

  it('GAP-L1 and GAP-L2 completed: GAP-L4 opens without GAP-L3', () => {
    assert.equal(isLessonUnlocked(lessons, 'GAP-L4', ['GAP-L1', 'GAP-L2']), true);
  });

  it('GAP-L4 depends only on its predecessor GAP-L2', () => {
    // GAP-L2 itself can only be opened after GAP-L1, so this order is still enforced.
    assert.equal(isLessonUnlocked(lessons, 'GAP-L4', ['GAP-L2']), true);
    assert.equal(isLessonUnlocked(lessons, 'GAP-L2', []), false);
  });

  it('the unpublished GAP-L3 cannot be opened from the list', () => {
    assert.equal(isLessonUnlocked(lessons, 'GAP-L3', ['GAP-L1', 'GAP-L2']), false);
  });
});
