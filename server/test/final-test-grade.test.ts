/**
 * Regression tests for QA finding H-1: the final-exam grade API must not reveal
 * the correct answers (or which questions were right/wrong) to the student.
 *
 * Run (no extra packages — Node's built-in runner + the repo's existing tsx):
 *   node --import tsx --test server/test/final-test-grade.test.ts
 *
 * Kept outside server/src so it is not part of the Nest build output.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gradeTestAnswers, type TestLockState } from '../src/tests/tests.helpers';
import { TestsController } from '../src/tests/tests.controller';
import type { GradeAnswers } from '../src/tests/tests.schemas';

const CHOICE_Q = '11111111-1111-4111-8111-111111111111';
const TEXT_Q = '22222222-2222-4222-8222-222222222222';
const CORRECT_OPTION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WRONG_OPTION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CORRECT_OPTION_TEXT = 'CORRECT-OPTION-TEXT-Тавхид';
const CORRECT_TEXT_ANSWER = 'Correct Text Answer Акыйда';

const TEST = {
  passingScore: 90,
  testQuestions: [
    {
      question: {
        id: CHOICE_Q,
        questionText: 'Choice question?',
        questionType: 'choice' as const,
        correctTextAnswer: null,
        options: [
          { id: CORRECT_OPTION_ID, optionText: CORRECT_OPTION_TEXT, isCorrect: true },
          { id: WRONG_OPTION_ID, optionText: 'wrong option text', isCorrect: false },
        ],
      },
    },
    {
      question: {
        id: TEXT_Q,
        questionText: 'Text question?',
        questionType: 'text' as const,
        correctTextAnswer: CORRECT_TEXT_ANSWER,
        options: [],
      },
    },
  ],
};

const ALL_WRONG: GradeAnswers = [
  { questionId: CHOICE_Q, selectedOptionId: WRONG_OPTION_ID },
  { questionId: TEXT_Q, textAnswer: 'something else' },
];
const ALL_RIGHT: GradeAnswers = [
  { questionId: CHOICE_Q, selectedOptionId: CORRECT_OPTION_ID },
  // Different case/spacing than the stored answer — must still count as correct.
  { questionId: TEXT_Q, textAnswer: '  correct   TEXT answer акыйда ' },
];
const HALF_RIGHT: GradeAnswers = [
  { questionId: CHOICE_Q, selectedOptionId: CORRECT_OPTION_ID },
  { questionId: TEXT_Q, textAnswer: 'something else' },
];

const LOCK: TestLockState = {
  locked: false,
  lockedUntil: null,
  remainingAttempts: 2,
  failedInWindow: 1,
};

/** Fields that would reveal the answer key or per-question correctness. */
const FORBIDDEN_KEYS = [
  'details',
  'isCorrect',
  'correctOptionId',
  'correctOptionText',
  'correctTextAnswer',
  'selectedOptionId',
  'textAnswer',
];
/** Values that are the answer key itself, in any casing. */
const FORBIDDEN_VALUES = [CORRECT_OPTION_ID, CORRECT_OPTION_TEXT, CORRECT_TEXT_ANSWER];

const STUDENT_KEYS = [
  'failedInWindow',
  'locked',
  'lockedUntil',
  'passed',
  'remainingAttempts',
  'scorePercent',
  'total',
].sort();

function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, out));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      collectKeys(child, out);
    }
  }
  return out;
}

function assertNoAnswerLeak(payload: unknown, label: string) {
  const json = JSON.stringify(payload);
  const lower = json.toLowerCase();
  for (const value of FORBIDDEN_VALUES) {
    assert.ok(
      !lower.includes(value.toLowerCase()),
      `${label}: response JSON contains the answer key value "${value}"\n${json}`,
    );
  }
  const keys = collectKeys(payload);
  for (const key of FORBIDDEN_KEYS) {
    assert.ok(!keys.has(key), `${label}: response JSON contains forbidden field "${key}"\n${json}`);
  }
}

/** Stand-in for TestsService whose gradeFinalTest() returns exactly what the real
 * one does after access/lock checks: `{ ...gradeTestAnswers(test, answers), ...nextLock }`. */
function controllerWithRealGrading() {
  const service = {
    gradeFinalTest: async (_ref: string, _user: unknown, answers: GradeAnswers) => ({
      ...gradeTestAnswers(TEST, answers),
      ...LOCK,
    }),
  };
  return new TestsController(service as never);
}

const STUDENT = { id: '33333333-3333-4333-8333-333333333333', role: 'user' as const };

describe('gradeTestAnswers()', () => {
  it('does not include the answer key or per-question results (failed attempt)', () => {
    assertNoAnswerLeak(gradeTestAnswers(TEST, ALL_WRONG), 'gradeTestAnswers(all wrong)');
  });

  it('does not include the answer key or per-question results (passed attempt)', () => {
    assertNoAnswerLeak(gradeTestAnswers(TEST, ALL_RIGHT), 'gradeTestAnswers(all right)');
  });

  it('still scores correctly', () => {
    const right = gradeTestAnswers(TEST, ALL_RIGHT);
    assert.equal(right.scorePercent, 100);
    assert.equal(right.passed, true);
    assert.equal(right.correct, 2);
    assert.equal(right.total, 2);

    const half = gradeTestAnswers(TEST, HALF_RIGHT);
    assert.equal(half.scorePercent, 50);
    assert.equal(half.passed, false);
    assert.equal(half.correct, 1);

    const wrong = gradeTestAnswers(TEST, ALL_WRONG);
    assert.equal(wrong.scorePercent, 0);
    assert.equal(wrong.passed, false);
  });
});

describe('POST /courses/:courseRef/final-test/grade (TestsController.grade) — student JSON', () => {
  for (const [label, answers] of [
    ['failed attempt', ALL_WRONG],
    ['half-right attempt', HALF_RIGHT],
    ['passed attempt', ALL_RIGHT],
  ] as const) {
    it(`does not reveal answers — ${label}`, async () => {
      const body = await controllerWithRealGrading().grade('course', STUDENT, { answers });
      assertNoAnswerLeak(body, `grade() ${label}`);
    });
  }

  it('returns only score, pass/fail, question total and attempt state', async () => {
    const body = await controllerWithRealGrading().grade('course', STUDENT, { answers: HALF_RIGHT });
    assert.deepEqual(Object.keys(body).sort(), STUDENT_KEYS);
    assert.equal(body.scorePercent, 50);
    assert.equal(body.passed, false);
    assert.equal(body.total, 2);
    assert.equal(body.remainingAttempts, 2);
    assert.equal(body.locked, false);
  });
});
