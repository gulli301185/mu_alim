/**
 * QA H-2 client (C3): API errors keep status, the server's code/details and Retry-After.
 * Pure module only — no network, no Vite (`import.meta.env` is never loaded here).
 *
 * Run: node --import tsx --test client/test/api-errors.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError, DEFAULT_RETRY_AFTER_SEC, parseApiErrorResponse, parseRetryAfter } from '../src/lib/api-errors';

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
    json: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
  };
}

describe('parseRetryAfter', () => {
  it('absent → undefined (caller uses DEFAULT_RETRY_AFTER_SEC = 60)', () => {
    assert.equal(parseRetryAfter(null), undefined);
    assert.equal(DEFAULT_RETRY_AFTER_SEC, 60);
  });

  it('delta-seconds; 0 becomes 1', () => {
    assert.equal(parseRetryAfter('42'), 42);
    assert.equal(parseRetryAfter(' 7 '), 7);
    assert.equal(parseRetryAfter('0'), 1);
  });

  it('HTTP date → seconds from now (at least 1)', () => {
    const now = Date.parse('2026-10-28T10:00:00Z');
    assert.equal(parseRetryAfter('Wed, 28 Oct 2026 10:00:30 GMT', now), 30);
    assert.equal(parseRetryAfter('Wed, 28 Oct 2026 09:00:00 GMT', now), 1);
  });

  it('garbage → undefined', () => {
    assert.equal(parseRetryAfter('soon'), undefined);
    assert.equal(parseRetryAfter(''), undefined);
  });
});

describe('parseApiErrorResponse', () => {
  it('403 LESSONS_INCOMPLETE: status, code, message and total/done details', async () => {
    const err = await parseApiErrorResponse(
      response(403, { error: 'Бардык сабактарды бүтүрүңүз', code: 'LESSONS_INCOMPLETE', total: 5, done: 3 }),
      'fallback',
    );
    assert.ok(err instanceof ApiError);
    assert.ok(err instanceof Error, 'still an Error for existing catch blocks');
    assert.equal(err.status, 403);
    assert.equal(err.code, 'LESSONS_INCOMPLETE');
    assert.equal(err.message, 'Бардык сабактарды бүтүрүңүз');
    assert.deepEqual(err.details, { total: 5, done: 3 });
  });

  it('429 with Retry-After → retryAfterSec', async () => {
    const err = await parseApiErrorResponse(
      response(429, { error: 'ThrottlerException: Too Many Requests' }, { 'Retry-After': '45' }),
      'fallback',
    );
    assert.equal(err.status, 429);
    assert.equal(err.retryAfterSec, 45);
  });

  it('429 without a readable Retry-After (e.g. CORS) → retryAfterSec undefined', async () => {
    const err = await parseApiErrorResponse(response(429, {}), 'fallback');
    assert.equal(err.retryAfterSec, undefined);
  });

  it('non-JSON or empty body → fallback message, no code', async () => {
    const err = await parseApiErrorResponse(response(500, new Error('not json')), 'Сабак белгиленген жок');
    assert.equal(err.message, 'Сабак белгиленген жок');
    assert.equal(err.code, undefined);
    assert.deepEqual(err.details, {});
    const empty = await parseApiErrorResponse(response(400, { error: '' }), 'fallback');
    assert.equal(empty.message, 'fallback');
  });
});
