/**
 * QA P0: JwtAuthGuard, AdminGuard and OptionalAuthGuard check the CURRENT account in the database
 * (id, role, isActive) after the token's signature and expiry, so an old token of a deleted,
 * blocked or demoted account no longer works, and `req.user` carries the role from the database.
 * A database failure fails closed (503) — also on the optional guard.
 *
 * Run (no database — JwtService is real with a throwaway test secret, the User repository is a mock):
 *   node --import tsx --test test/auth-guards.test.ts        (from server/)
 *
 * Kept outside server/src so it is not part of the Nest build output.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Repository } from 'typeorm';
import { AppError } from '../src/common/app-error';
import {
  ACCOUNT_DISABLED_MESSAGE,
  AdminGuard,
  type AuthedRequest,
  JwtAuthGuard,
  OptionalAuthGuard,
  SESSION_INVALID_MESSAGE,
} from '../src/common/auth';
import { translateErrorBody } from '../src/common/i18n';
import type { User } from '../src/database/entities';

const ADMIN_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '33333333-3333-4333-8333-333333333333';

// A throwaway secret for this test process only.
const jwt = new JwtService({ secret: randomBytes(32).toString('hex') });
const otherJwt = new JwtService({ secret: randomBytes(32).toString('hex') });

type Account = { id: string; role: 'user' | 'admin'; isActive: boolean };

/**
 * In-memory stand-in for Repository<User>.findOne; records every query. Like the database it
 * returns ONLY the selected columns (a row also carries columns the guard must not rely on), so a
 * guard that reads an unselected field would see `undefined` here, just as in production.
 */
function repo(accounts: Account[], fail?: Error) {
  const calls: unknown[] = [];
  const users = {
    async findOne(options: { where: { id: string }; select?: Record<string, boolean> }) {
      calls.push(options);
      if (fail) throw fail;
      const row = accounts.find((a) => a.id === options.where.id);
      if (!row) return null;
      const full: Record<string, unknown> = { ...row, email: 'hidden@example.test', isVerified: true, passwordHash: 'not-selected' };
      if (!options.select) return full;
      return Object.fromEntries(Object.entries(full).filter(([column]) => options.select?.[column] === true));
    },
  } as unknown as Repository<User>;
  return { users, calls };
}

function http(authorization?: string) {
  const req = { headers: authorization ? { authorization } : {} } as AuthedRequest;
  const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return { req, context };
}

const bearer = (payload: object, service: JwtService = jwt) => `Bearer ${service.sign(payload)}`;

function rejectsWith(status: number, code?: string, error?: string) {
  return (err: unknown) => {
    assert.ok(err instanceof AppError, `expected AppError, got ${String(err)}`);
    assert.equal(err.getStatus(), status);
    const body = err.getResponse() as { error?: string; code?: string };
    if (code !== undefined) assert.equal(body.code, code);
    if (error !== undefined) assert.equal(body.error, error);
    return true;
  };
}

const activeAdmin: Account = { id: ADMIN_ID, role: 'admin', isActive: true };
const activeUser: Account = { id: USER_ID, role: 'user', isActive: true };

describe('repository mock', () => {
  it('M1: returns only the selected columns (as the database does), all columns without a select', async () => {
    const { users } = repo([activeUser]);
    const picked = await users.findOne({ where: { id: USER_ID }, select: { id: true, isActive: true } } as never);
    assert.deepEqual(picked, { id: USER_ID, isActive: true });
    const whole = (await users.findOne({ where: { id: USER_ID } } as never)) as unknown as Record<string, unknown>;
    assert.equal(whole.isVerified, true);
    assert.equal(whole.passwordHash, 'not-selected');
  });
});

describe('JwtAuthGuard', () => {
  it('U1: no Authorization header → 401 "Кирүү талап кылынат", the database is not queried', async () => {
    const { users, calls } = repo([activeUser]);
    const { context } = http();
    await assert.rejects(new JwtAuthGuard(jwt, users).canActivate(context), rejectsWith(401, undefined, 'Кирүү талап кылынат'));
    assert.equal(calls.length, 0);
  });

  it('U2: a token signed with another secret, an expired token or garbage → 401 "Жараксыз токен", no query', async () => {
    const { users, calls } = repo([activeUser]);
    const tokens = [
      bearer({ id: USER_ID, role: 'user' }, otherJwt),
      bearer({ id: USER_ID, role: 'user', exp: Math.floor(Date.now() / 1000) - 60 }),
      'Bearer not-a-jwt',
    ];
    for (const token of tokens) {
      const { context } = http(token);
      await assert.rejects(new JwtAuthGuard(jwt, users).canActivate(context), rejectsWith(401, undefined, 'Жараксыз токен'));
    }
    assert.equal(calls.length, 0);
  });

  it('U3: an active user → true; req.user comes from the database; one query selecting only id, role, isActive', async () => {
    const { users, calls } = repo([activeUser]);
    const { req, context } = http(bearer({ id: USER_ID, role: 'user' }));
    assert.equal(await new JwtAuthGuard(jwt, users).canActivate(context), true);
    assert.deepEqual(req.user, { id: USER_ID, role: 'user' });
    assert.deepEqual(calls, [{ where: { id: USER_ID }, select: { id: true, role: true, isActive: true } }]);
  });

  it('U4: the account no longer exists (deleted) → 401 SESSION_INVALID, req.user is not set', async () => {
    const { users } = repo([]);
    const { req, context } = http(bearer({ id: USER_ID, role: 'user' }));
    await assert.rejects(new JwtAuthGuard(jwt, users).canActivate(context), rejectsWith(401, 'SESSION_INVALID', SESSION_INVALID_MESSAGE));
    assert.equal(req.user, undefined);
  });

  it('U5: a blocked user (isActive=false) with an old token → 403 ACCOUNT_DISABLED', async () => {
    const { users } = repo([{ ...activeUser, isActive: false }]);
    const { req, context } = http(bearer({ id: USER_ID, role: 'user' }));
    await assert.rejects(new JwtAuthGuard(jwt, users).canActivate(context), rejectsWith(403, 'ACCOUNT_DISABLED', ACCOUNT_DISABLED_MESSAGE));
    assert.equal(req.user, undefined);
  });

  it('U6: the token says admin but the database says user (demoted) → 401 SESSION_INVALID', async () => {
    const { users } = repo([{ id: ADMIN_ID, role: 'user', isActive: true }]);
    const { context } = http(bearer({ id: ADMIN_ID, role: 'admin' }));
    await assert.rejects(new JwtAuthGuard(jwt, users).canActivate(context), rejectsWith(401, 'SESSION_INVALID'));
  });

  it('U7: the token says user but the database says admin → 401 SESSION_INVALID (no silent upgrade)', async () => {
    const { users } = repo([{ id: USER_ID, role: 'admin', isActive: true }]);
    const { context } = http(bearer({ id: USER_ID, role: 'user' }));
    await assert.rejects(new JwtAuthGuard(jwt, users).canActivate(context), rejectsWith(401, 'SESSION_INVALID'));
  });

  it('U8: a validly signed token with a malformed id or role → 401 SESSION_INVALID, no query', async () => {
    const { users, calls } = repo([activeUser]);
    for (const payload of [{ id: 'not-a-uuid', role: 'user' }, { id: USER_ID, role: 'owner' }, { role: 'user' }]) {
      const { context } = http(bearer(payload));
      await assert.rejects(new JwtAuthGuard(jwt, users).canActivate(context), rejectsWith(401, 'SESSION_INVALID'));
    }
    assert.equal(calls.length, 0);
  });

  it('U9: a database failure → 503 AUTH_UNAVAILABLE without internal details, req.user is not set', async () => {
    const internal = 'connect ECONNREFUSED 10.0.0.5:5432 internal-detail-xyz';
    const { users } = repo([activeUser], new Error(internal));
    const { req, context } = http(bearer({ id: USER_ID, role: 'user' }));
    await assert.rejects(new JwtAuthGuard(jwt, users).canActivate(context), (err: unknown) => {
      rejectsWith(503, 'AUTH_UNAVAILABLE', 'Сервер катасы')(err);
      assert.ok(!JSON.stringify((err as AppError).getResponse()).includes('ECONNREFUSED'));
      assert.ok(!JSON.stringify((err as AppError).getResponse()).includes('internal-detail-xyz'));
      return true;
    });
    assert.equal(req.user, undefined);
  });
});

describe('AdminGuard', () => {
  it('A1: an active admin → true, req.user is the admin from the database', async () => {
    const { users } = repo([activeAdmin]);
    const { req, context } = http(bearer({ id: ADMIN_ID, role: 'admin' }));
    assert.equal(await new AdminGuard(jwt, users).canActivate(context), true);
    assert.deepEqual(req.user, { id: ADMIN_ID, role: 'admin' });
  });

  it('A2: an active user on an admin route → 403 "Админ укугу керек"', async () => {
    const { users } = repo([activeUser]);
    const { context } = http(bearer({ id: USER_ID, role: 'user' }));
    await assert.rejects(new AdminGuard(jwt, users).canActivate(context), rejectsWith(403, undefined, 'Админ укугу керек'));
  });

  it('A3: a blocked admin with an old token → 403 ACCOUNT_DISABLED', async () => {
    const { users } = repo([{ ...activeAdmin, isActive: false }]);
    const { context } = http(bearer({ id: ADMIN_ID, role: 'admin' }));
    await assert.rejects(new AdminGuard(jwt, users).canActivate(context), rejectsWith(403, 'ACCOUNT_DISABLED'));
  });

  it('A4: a deleted admin with an old token → 401 SESSION_INVALID', async () => {
    const { users } = repo([]);
    const { context } = http(bearer({ id: ADMIN_ID, role: 'admin' }));
    await assert.rejects(new AdminGuard(jwt, users).canActivate(context), rejectsWith(401, 'SESSION_INVALID'));
  });

  it('A5: a demoted admin (admin in the token, user in the database) → 401 SESSION_INVALID, not 403', async () => {
    const { users } = repo([{ id: ADMIN_ID, role: 'user', isActive: true }]);
    const { context } = http(bearer({ id: ADMIN_ID, role: 'admin' }));
    await assert.rejects(new AdminGuard(jwt, users).canActivate(context), rejectsWith(401, 'SESSION_INVALID'));
  });

  it('A6: no token → 401, a database failure → 503 (never a 200)', async () => {
    await assert.rejects(new AdminGuard(jwt, repo([activeAdmin]).users).canActivate(http().context), rejectsWith(401));
    const { users } = repo([activeAdmin], new Error('timeout'));
    await assert.rejects(
      new AdminGuard(jwt, users).canActivate(http(bearer({ id: ADMIN_ID, role: 'admin' })).context),
      rejectsWith(503, 'AUTH_UNAVAILABLE'),
    );
  });
});

describe('OptionalAuthGuard', () => {
  it('O1: no token → true and anonymous, no query', async () => {
    const { users, calls } = repo([activeUser]);
    const { req, context } = http();
    assert.equal(await new OptionalAuthGuard(jwt, users).canActivate(context), true);
    assert.equal(req.user, undefined);
    assert.equal(calls.length, 0);
  });

  it('O2: invalid, deleted, blocked, demoted or malformed sessions → true and anonymous (never an error)', async () => {
    const cases: { accounts: Account[]; token: string }[] = [
      { accounts: [activeUser], token: 'Bearer not-a-jwt' },
      { accounts: [activeUser], token: bearer({ id: USER_ID, role: 'user' }, otherJwt) },
      { accounts: [], token: bearer({ id: USER_ID, role: 'user' }) },
      { accounts: [{ ...activeUser, isActive: false }], token: bearer({ id: USER_ID, role: 'user' }) },
      { accounts: [{ id: ADMIN_ID, role: 'user', isActive: true }], token: bearer({ id: ADMIN_ID, role: 'admin' }) },
      { accounts: [activeUser], token: bearer({ id: 'not-a-uuid', role: 'user' }) },
    ];
    for (const { accounts, token } of cases) {
      const { req, context } = http(token);
      assert.equal(await new OptionalAuthGuard(jwt, repo(accounts).users).canActivate(context), true);
      assert.equal(req.user, undefined);
    }
  });

  it('O3: an active account → true and req.user from the database', async () => {
    const { req, context } = http(bearer({ id: USER_ID, role: 'user' }));
    assert.equal(await new OptionalAuthGuard(jwt, repo([activeUser]).users).canActivate(context), true);
    assert.deepEqual(req.user, { id: USER_ID, role: 'user' });
  });

  it('O4: a database failure or timeout is NOT anonymous access — 503 AUTH_UNAVAILABLE (fail closed)', async () => {
    for (const failure of [new Error('connection terminated'), Object.assign(new Error('timeout'), { name: 'QueryFailedError' })]) {
      const { req, context } = http(bearer({ id: USER_ID, role: 'user' }));
      await assert.rejects(
        new OptionalAuthGuard(jwt, repo([activeUser], failure).users).canActivate(context),
        rejectsWith(503, 'AUTH_UNAVAILABLE'),
      );
      assert.equal(req.user, undefined);
    }
  });
});

describe('Russian translations of the new errors', () => {
  it('R2: SESSION_INVALID / ACCOUNT_DISABLED are translated and keep their code', () => {
    assert.deepEqual(
      translateErrorBody({ error: SESSION_INVALID_MESSAGE, code: 'SESSION_INVALID' }, 'ru'),
      { error: 'Сессия недействительна. Войдите снова.', code: 'SESSION_INVALID' },
    );
    assert.deepEqual(
      translateErrorBody({ error: ACCOUNT_DISABLED_MESSAGE, code: 'ACCOUNT_DISABLED' }, 'ru'),
      { error: 'Аккаунт заблокирован', code: 'ACCOUNT_DISABLED' },
    );
    assert.deepEqual(
      translateErrorBody({ error: 'Сервер катасы', code: 'AUTH_UNAVAILABLE' }, 'ru'),
      { error: 'Ошибка сервера', code: 'AUTH_UNAVAILABLE' },
    );
  });
});
