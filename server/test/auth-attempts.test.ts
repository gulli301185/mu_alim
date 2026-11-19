/**
 * QA F-6 / F-4: wrong auth-code attempts are limited per account, IPv6 clients are rate-limited
 * by their /64, and a failed login takes the same time whether or not the account exists.
 *
 * Run (no database, SMTP or network — every dependency of AuthService is a mock):
 *   node --import tsx --test server/test/auth-attempts.test.ts
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../src/common/app-error';
import { rateLimitKey } from '../src/common/client-ip';
import { AuthService } from '../src/auth/auth.service';
import { CodeAttemptLimiter, MAX_WRONG_CODES } from '../src/auth/code-attempts';

describe('CodeAttemptLimiter', () => {
  it('numbers attempts and refuses once they are used up', () => {
    const limiter = new CodeAttemptLimiter(3, 1000, () => 0);
    assert.deepEqual([1, 2, 3, 4, 5].map(() => limiter.tryAcquire('u')), [1, 2, 3, 0, 0]);
    assert.equal(limiter.isLocked('u'), true);
  });

  it('forgets an account after the window and on reset', () => {
    let t = 0;
    const limiter = new CodeAttemptLimiter(2, 1000, () => t);
    limiter.tryAcquire('a');
    limiter.tryAcquire('a');
    assert.equal(limiter.tryAcquire('a'), 0);
    t = 999;
    assert.equal(limiter.tryAcquire('a'), 0);
    t = 1000;
    assert.equal(limiter.tryAcquire('a'), 1, 'a new window starts');
    limiter.reset('a');
    assert.equal(limiter.tryAcquire('a'), 1, 'reset clears the count');
  });

  it('keeps accounts apart', () => {
    const limiter = new CodeAttemptLimiter(1, 1000, () => 0);
    assert.equal(limiter.tryAcquire('x'), 1);
    assert.equal(limiter.tryAcquire('x'), 0);
    assert.equal(limiter.tryAcquire('y'), 1);
  });
});

describe('rateLimitKey', () => {
  it('keeps IPv4 as is', () => assert.equal(rateLimitKey('203.0.113.7'), '203.0.113.7'));
  it('maps IPv4-mapped IPv6 to IPv4', () => assert.equal(rateLimitKey('::ffff:203.0.113.7'), '203.0.113.7'));
  it('uses the /64 of an IPv6 address', () => {
    assert.equal(rateLimitKey('2a02:c207:2359:9383::1'), '2a02:c207:2359:9383::/64');
    assert.equal(rateLimitKey('2a02:c207:2359:9383:ffff:1:2:3'), '2a02:c207:2359:9383::/64');
    assert.equal(rateLimitKey('2001:DB8::1'), '2001:db8:0:0::/64');
    assert.equal(rateLimitKey('2001:0db8:0000:0042::9'), '2001:db8:0:42::/64');
    assert.equal(rateLimitKey('fe80::1%eth0'), 'fe80:0:0:0::/64');
  });
  it('two addresses of one /64 share a key, another /64 does not', () => {
    assert.equal(rateLimitKey('2a02:c207:2359:9383::1'), rateLimitKey('2a02:c207:2359:9383::dead:beef'));
    assert.notEqual(rateLimitKey('2a02:c207:2359:9383::1'), rateLimitKey('2a02:c207:2359:9384::1'));
  });
  it('passes anything else through', () => assert.equal(rateLimitKey('unknown'), 'unknown'));
});

function service(opts: { liveCode: () => boolean; userExists?: boolean; dbDelayMs?: number }) {
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'user@test.local',
    firstName: 'A',
    lastName: 'B',
    phone: null,
    role: 'user' as const,
    isActive: true,
    isVerified: false,
    passwordHash: 'not-used-by-these-tests',
  };
  const revokes: unknown[] = [];
  const db = { checks: 0 };
  const logs: string[] = [];
  const users = {
    createQueryBuilder: () => {
      const qb = { where: () => qb, getOne: async () => (opts.userExists === false ? null : user) };
      return qb;
    },
    update: async () => ({ affected: 1 }),
    findOneByOrFail: async () => ({ ...user, isVerified: true }),
  };
  const tokens = {
    existsBy: async () => {
      db.checks += 1;
      if (opts.dbDelayMs) await new Promise((r) => setTimeout(r, opts.dbDelayMs));
      return opts.liveCode();
    },
    update: async (where: unknown) => {
      revokes.push(where);
      return { affected: 1 };
    },
    delete: async () => ({ affected: 0 }),
  };
  const em = {
    createQueryBuilder: () => {
      const qb = { update: () => qb, set: () => qb, where: () => qb, andWhere: () => qb, execute: async () => ({ affected: 1 }) };
      return qb;
    },
    update: async () => ({ affected: 1 }),
  };
  const ds = { query: async () => [], transaction: async (cb: (m: typeof em) => unknown) => cb(em) };
  const svc = new AuthService(users as never, tokens as never, ds as never, { sign: () => 'jwt' } as never, {} as never);
  (svc as unknown as { logger: object }).logger = { log: (m: string) => logs.push(m), warn: (m: string) => logs.push(m), error: (m: string) => logs.push(m) };
  return { svc, revokes, logs, db };
}

const isInvalid = (err: unknown) => err instanceof AppError && err.getStatus() === 400;
const confirm = (svc: AuthService, code: string) =>
  svc.confirmCode({ email: 'user@test.local', code, password: 'New-pw-12345' } as never);

describe('AuthService: wrong codes per account (F-6)', () => {
  it(`after ${MAX_WRONG_CODES} wrong codes the live codes are revoked and even the right code is refused`, async () => {
    let live = false;
    const { svc, revokes, logs } = service({ liveCode: () => live });
    for (let i = 0; i < MAX_WRONG_CODES; i += 1) await assert.rejects(confirm(svc, '000000'), isInvalid);
    assert.equal(revokes.length, 1, 'live codes revoked exactly once, at the limit');
    assert.match(logs.join('\n'), /too many wrong codes: live codes revoked/);
    assert.ok(!logs.join('\n').includes('user@test.local'), 'no address in the log');
    live = true; // the right code (or a code issued later) during the lockout window
    await assert.rejects(confirm(svc, '123456'), isInvalid);
    await assert.rejects(
      svc.resetPassword({ email: 'user@test.local', token: '123456', password: 'X-pw-12345', confirmPassword: 'X-pw-12345' } as never),
      isInvalid,
      'the lock covers password reset too',
    );
  });

  it('a right code before the limit works and clears the count', async () => {
    let live = false;
    const { svc, revokes } = service({ liveCode: () => live });
    for (let i = 0; i < MAX_WRONG_CODES - 1; i += 1) await assert.rejects(confirm(svc, '000000'), isInvalid);
    live = true;
    const ok = await confirm(svc, '123456');
    assert.equal(ok.token, 'jwt');
    live = false;
    for (let i = 0; i < MAX_WRONG_CODES - 1; i += 1) await assert.rejects(confirm(svc, '000000'), isInvalid);
    assert.equal(revokes.length, 0, 'the count started again after the success');
  });

  it(`${MAX_WRONG_CODES * 10} PARALLEL guesses: at most ${MAX_WRONG_CODES} reach the database, codes revoked once`, async () => {
    const { svc, revokes, db } = service({ liveCode: () => false, dbDelayMs: 25 });
    const guesses = Array.from({ length: MAX_WRONG_CODES * 10 }, (_, i) => String(100000 + i));
    const results = await Promise.allSettled(guesses.map((code) => confirm(svc, code)));
    assert.ok(results.every((r) => r.status === 'rejected' && isInvalid(r.reason)), 'every guess gets the same 400');
    assert.equal(db.checks, MAX_WRONG_CODES, `codes checked against the database: ${db.checks}`);
    assert.equal(revokes.length, 1, 'live codes revoked exactly once');
  });

  it('parallel guesses on confirm-code and reset-password share one budget', async () => {
    const { svc, db } = service({ liveCode: () => false, dbDelayMs: 25 });
    const reset = (token: string) =>
      svc.resetPassword({ email: 'user@test.local', token, password: 'X-pw-12345', confirmPassword: 'X-pw-12345' } as never);
    await Promise.allSettled(Array.from({ length: 20 }, (_, i) => (i % 2 ? confirm(svc, '111111') : reset('222222'))));
    assert.equal(db.checks, MAX_WRONG_CODES);
  });

  it('unknown emails are not counted and get the same answer', async () => {
    const { svc, revokes } = service({ liveCode: () => false, userExists: false });
    for (let i = 0; i < MAX_WRONG_CODES + 2; i += 1) await assert.rejects(confirm(svc, '000000'), isInvalid);
    assert.equal(revokes.length, 0);
  });
});

describe('AuthService: login timing does not reveal the account (F-4)', () => {
  it('an unknown email still runs a bcrypt comparison', async () => {
    const { svc } = service({ liveCode: () => false, userExists: false });
    const started = process.hrtime.bigint();
    await assert.rejects(svc.login({ email: 'nobody@test.local', password: 'Whatever-123' } as never), (e: unknown) => e instanceof AppError && e.getStatus() === 401);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(ms >= 20, `answered in ${ms.toFixed(1)} ms — no bcrypt work was done`);
  });
});
