/**
 * QA A5: when an auth code cannot be emailed (or the background issue fails), AuthService logs
 * only a short error tag — never the error's message, response or stack, which can quote the
 * address, the code, the SMTP login or the server's reply.
 *
 * Run (no database, SMTP or network — every dependency of AuthService is a mock):
 *   node --import tsx --test server/test/auth-logging.test.ts
 *
 * Kept outside server/src so it is not part of the Nest build output.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { QueryFailedError } from 'typeorm';
import { AppError } from '../src/common/app-error';
import { AuthService } from '../src/auth/auth.service';

const EMAIL = 'victim@example.com';
const SMTP_SECRET_TEXT =
  'Invalid login: 535-5.7.8 Username and Password not accepted for victim@example.com pass=S3cret! smtp.example.com:587';
/** Pieces that must never reach a log line. */
const SENSITIVE = ['Invalid login', '535', '@', 'victim', 'example.com', 'S3cret', 'pass=', 'smtp.example'];

type Logged = string[];

function smtpAuthError() {
  return Object.assign(new Error(SMTP_SECRET_TEXT), {
    code: 'EAUTH',
    command: 'AUTH PLAIN',
    responseCode: 535,
    response: '535-5.7.8 Username and Password not accepted (victim@example.com, S3cret!)',
  });
}

function setup(opts: { sendError: unknown; tokenUpdateError?: unknown }) {
  const logs: Logged = [];
  const codes: string[] = [];
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    email: EMAIL,
    firstName: 'Test',
    lastName: 'User',
    phone: '+996700123456',
    role: 'user' as const,
    isActive: true,
    isVerified: false,
    passwordHash: 'x',
  };
  let tokenUpdates = 0;

  const users = {
    createQueryBuilder: () => {
      const qb = { where: () => qb, getOne: async () => user };
      return qb;
    },
    findOneBy: async () => null, // register: the email is new
    delete: async () => ({ affected: 1 }),
    update: async () => ({ affected: 1 }),
  };
  const tokens = {
    update: async () => {
      tokenUpdates += 1;
      if (opts.tokenUpdateError && tokenUpdates === 1) throw opts.tokenUpdateError;
      return { affected: 1 };
    },
    create: (row: object) => row,
    save: async (row: object) => ({ ...row, id: '22222222-2222-4222-8222-222222222222' }),
    existsBy: async () => false,
  };
  const em = {
    create: (_entity: unknown, row: object) => row,
    save: async (row: object) => ({ ...row, id: user.id }),
  };
  const ds = {
    query: async () => [], // findUserByKgPhone: the phone is free
    transaction: async (cb: (manager: typeof em) => unknown) => cb(em),
  };
  const jwt = { sign: () => 'unused' };
  const mail = {
    isConfigured: () => true,
    sendAuthCode: async (_to: string, code: string) => {
      codes.push(code);
      throw opts.sendError;
    },
  };

  const service = new AuthService(users as never, tokens as never, ds as never, jwt as never, mail as never);
  const capture = (m: unknown) => logs.push(String(m));
  (service as unknown as { logger: object }).logger = { log: capture, warn: capture, error: capture, debug: capture };
  return { service, logs, codes };
}

function assertClean(logs: Logged, codes: string[], extra: string[] = []) {
  const text = logs.join('\n');
  for (const piece of [...SENSITIVE, ...extra]) {
    assert.ok(!text.includes(piece), `log contains "${piece}":\n${text}`);
  }
  for (const code of codes) assert.ok(!text.includes(code), `log contains the OTP code:\n${text}`);
}

async function expect503(promise: Promise<unknown>) {
  await assert.rejects(promise, (err: unknown) => err instanceof AppError && err.getStatus() === 503);
}

describe('A5 — AuthService logs only a safe error tag (all dependencies mocked)', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup({ sendError: smtpAuthError() });
  });

  it('U1: forgot-password, SMTP auth error in the background → "reset code not delivered (EAUTH)", nothing sensitive', async () => {
    const res = await ctx.service.forgotPassword({ email: EMAIL });
    assert.ok(typeof res.message === 'string');
    await ctx.service.settleBackgroundTasks();

    assert.equal(ctx.codes.length, 1, 'the mail mock was not called');
    assert.ok(ctx.logs.includes('[auth-code] reset code not delivered (EAUTH)'), ctx.logs.join('\n'));
    assertClean(ctx.logs, ctx.codes);
  });

  it('U2: resend-code, SMTP auth error → 503 and "register code not delivered (EAUTH)", nothing sensitive', async () => {
    await expect503(ctx.service.resendCode({ email: EMAIL }));

    assert.equal(ctx.codes.length, 1);
    assert.ok(ctx.logs.includes('[auth-code] register code not delivered (EAUTH)'), ctx.logs.join('\n'));
    assertClean(ctx.logs, ctx.codes);
  });

  it('U3: registration of a new account, SMTP auth error → 503 and the same safe line, nothing sensitive', async () => {
    await expect503(
      ctx.service.register({
        email: EMAIL,
        phone: '+996700123456',
        password: 'Secret-pass-1',
        firstName: 'Test',
        lastName: 'User',
      } as never),
    );

    assert.equal(ctx.codes.length, 1);
    assert.ok(ctx.logs.includes('[auth-code] register code not delivered (EAUTH)'), ctx.logs.join('\n'));
    assertClean(ctx.logs, ctx.codes, ['Secret-pass-1']);
  });

  it('U4: a rejected recipient → tag SMTP_REJECTED, no address', async () => {
    ctx = setup({ sendError: new Error(`SMTP_REJECTED 1 recipient(s) ${EMAIL}`) });
    await expect503(ctx.service.resendCode({ email: EMAIL }));

    assert.ok(ctx.logs.includes('[auth-code] register code not delivered (SMTP_REJECTED)'), ctx.logs.join('\n'));
    assertClean(ctx.logs, ctx.codes);
  });

  it('U5: an error without a code → tag "Error", its message is not logged', async () => {
    ctx = setup({ sendError: new Error(`anything secret: ${SMTP_SECRET_TEXT}`) });
    await expect503(ctx.service.resendCode({ email: EMAIL }));

    assert.ok(ctx.logs.includes('[auth-code] register code not delivered (Error)'), ctx.logs.join('\n'));
    assertClean(ctx.logs, ctx.codes, ['anything secret']);
  });

  it('U6: background issue fails with a PostgreSQL error → "QueryFailedError:23505", no SQL text, values or address', async () => {
    const driverError = Object.assign(
      new Error('duplicate key value violates unique constraint "password_reset_tokens_token_key" user@x.kg 123456'),
      { code: '23505', detail: 'Key (token)=(123456) already exists.', table: 'password_reset_tokens' },
    );
    const dbError = new QueryFailedError(
      'UPDATE "password_reset_tokens" SET "used_at" = $1 WHERE "user_id" = $2',
      ['user@x.kg', '123456'],
      driverError,
    );
    ctx = setup({ sendError: smtpAuthError(), tokenUpdateError: dbError });

    await ctx.service.forgotPassword({ email: EMAIL });
    await ctx.service.settleBackgroundTasks();

    assert.equal(ctx.codes.length, 0, 'no code should have been emailed');
    assert.ok(ctx.logs.includes('[auth-code] forgot-password failed (QueryFailedError:23505)'), ctx.logs.join('\n'));
    assertClean(ctx.logs, ctx.codes, ['user@x.kg', '123456', 'duplicate key', 'Key (token)', 'password_reset_tokens', 'UPDATE']);
  });

  it('U7: an unknown or malformed err.code is not logged as it is → tag "Error"', async () => {
    for (const code of ['abc def <x@y.kg>', 'ESECRET_123456', 'X'.repeat(5000), 42]) {
      ctx = setup({ sendError: Object.assign(new Error(SMTP_SECRET_TEXT), { code }) });
      await expect503(ctx.service.resendCode({ email: EMAIL }));

      assert.ok(ctx.logs.includes('[auth-code] register code not delivered (Error)'), `code ${String(code).slice(0, 20)}: ${ctx.logs.join('\n')}`);
      assertClean(ctx.logs, ctx.codes, ['x@y.kg', 'ESECRET', 'XXXXX']);
    }
  });
});
