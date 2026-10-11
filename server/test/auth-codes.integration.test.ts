/**
 * QA F6 + F15 — registration / password-reset codes, against a real PostgreSQL test database.
 *
 * F6:  an unverified account pre-registered with someone else's email must end up with the
 *      password chosen by whoever confirms the emailed code (the mailbox owner).
 * F15: a code issued for password reset must not confirm a registration and vice versa;
 *      codes without a recorded purpose are refused; every code works at most once.
 *
 * Needs an isolated, disposable database whose name ends in `_test` on localhost, and a fresh
 * build (Nest DI needs decorator metadata, which tsx does not emit):
 *
 *   npm run build:server
 *   AUTH_TEST_DATABASE_URL=postgresql://…@localhost:5433/mualim_auth_test \
 *   TSX_TSCONFIG_PATH=server/tsconfig.json node --import tsx --test server/test/auth-codes.integration.test.ts
 *
 * R1: codes are emailed only. SMS is mocked as *configured* and must never be used —
 *     the phone on an account is unverified and chosen by whoever registered it.
 *
 * The test wipes the users of that database before every case. No mail or SMS is sent:
 * MailService and SmsService are replaced in-process and the codes are captured.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

const DB_URL = process.env.AUTH_TEST_DATABASE_URL;
const SERVER = resolve(__dirname, '..');
const DIST = resolve(SERVER, 'dist');

function assertSafeTestDatabase(url: string) {
  const u = new URL(url);
  const db = u.pathname.replace(/^\//, '');
  assert.ok(['localhost', '127.0.0.1'].includes(u.hostname), 'AUTH_TEST_DATABASE_URL must point to localhost');
  assert.ok(db.endsWith('_test') && db !== 'mualim', `refusing to wipe database "${db}" (name must end in _test)`);
}

function assertFreshBuild() {
  const pairs = [
    'auth/auth.service',
    'auth/auth.controller',
    'lib/auth-validation',
    'database/bootstrap-schema',
    'database/entities',
  ];
  for (const name of pairs) {
    const src = statSync(resolve(SERVER, 'src', `${name}.ts`)).mtimeMs;
    let built = 0;
    try {
      built = statSync(resolve(DIST, `${name}.js`)).mtimeMs;
    } catch {
      /* missing build */
    }
    assert.ok(built >= src, `server/dist is older than src/${name}.ts — run "npm run build:server" first`);
  }
}

type SentCode = { to: string; code: string; kind: 'register' | 'reset' };
type Json = Record<string, any>;

describe('F6 / F15 — auth codes (integration)', { skip: !DB_URL && 'AUTH_TEST_DATABASE_URL is not set' }, () => {
  let app: any;
  let ds: any;
  let base = '';
  const sent: SentCode[] = [];
  const smsSent: { to: string; code: string }[] = [];
  let smsEverSent = 0;
  let mailConfigured = true;
  let mailFails = false;
  let ipCounter = 0;
  let phoneCounter = 0;

  before(async () => {
    assertSafeTestDatabase(DB_URL!);
    assertFreshBuild();
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: DB_URL,
      DATABASE_SCHEMA: 'public',
      JWT_SECRET: randomBytes(32).toString('hex'),
      REDIS_URL: '',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      SMS_LOGIN: '',
      SMS_PASSWORD: '',
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: '',
    });

    const { NestFactory } = require('@nestjs/core');
    const { json } = require('express');
    const { DataSource } = require('typeorm');
    const { AppModule } = require(resolve(DIST, 'app.module.js'));
    const { AllExceptionsFilter } = require(resolve(DIST, 'common/all-exceptions.filter.js'));
    const { langMiddleware } = require(resolve(DIST, 'common/i18n.js'));
    const { MailService } = require(resolve(DIST, 'mail/mail.service.js'));
    const { SmsService } = require(resolve(DIST, 'mail/sms.service.js'));
    const { ensureAuthCodeColumns } = require(resolve(DIST, 'database/bootstrap-schema.js'));

    app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
    ds = app.get(DataSource);
    const [{ db }] = await ds.query('SELECT current_database() AS db');
    assert.ok(String(db).endsWith('_test'), `connected to "${db}", expected a *_test database`);

    // Startup migration: adds the column to the pre-change schema; must be repeatable.
    await ensureAuthCodeColumns(ds);
    await ensureAuthCodeColumns(ds);

    const mail = app.get(MailService);
    mail.isConfigured = () => mailConfigured;
    mail.sendAuthCode = async (to: string, code: string, kind: 'register' | 'reset') => {
      if (mailFails) throw new Error('SMTP_REJECTED (test)');
      sent.push({ to, code, kind });
    };
    // SMS looks fully set up, so any code that reaches it would really be sent.
    const sms = app.get(SmsService);
    sms.isConfigured = () => true;
    sms.sendPasswordResetSms = async (to: string, code: string) => {
      smsSent.push({ to, code });
      smsEverSent += 1;
    };

    app.use(json());
    app.use(langMiddleware);
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/api`.replace('[::1]', '127.0.0.1');
  });

  after(async () => {
    if (ds) await ds.query('TRUNCATE users CASCADE');
    await app?.close();
    assert.equal(smsEverSent, 0, 'an auth code was sent by SMS during the run');
  });

  beforeEach(async () => {
    await ds.query('TRUNCATE users CASCADE');
    sent.length = 0;
    smsSent.length = 0;
    mailConfigured = true;
    mailFails = false;
  });

  /** Each request gets its own client IP so the per-IP throttler never interferes. */
  async function post(path: string, body: Json, token?: string) {
    ipCounter += 1;
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'ky',
        'CF-Connecting-IP': `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: Json = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* empty body */
    }
    return { status: res.status, data, text };
  }

  function phone() {
    phoneCounter += 1;
    return `+996700${String(100000 + phoneCounter).slice(-6)}`;
  }

  const email = (name: string) => `${name}-${randomBytes(3).toString('hex')}@test.local`;

  function lastCode(to: string, kind: 'register' | 'reset') {
    const hit = [...sent].reverse().find((s) => s.to === to && s.kind === kind);
    assert.ok(hit, `no ${kind} code was sent to ${to}`);
    return hit.code;
  }

  function register(to: string, password: string, extra: Json = {}) {
    return post('/auth/register', {
      firstName: 'Аты',
      lastName: 'Фамилия',
      email: to,
      phone: phone(),
      password,
      ...extra,
    });
  }

  const login = (to: string, password: string) => post('/auth/login', { email: to, password });

  async function userRow(to: string) {
    const [row] = await ds.query(
      'SELECT id, password_hash, is_verified, first_name, last_name, phone FROM users WHERE email = $1',
      [to],
    );
    return row;
  }

  async function verifiedUser(to: string, password: string) {
    assert.equal((await register(to, password)).status, 201);
    const r = await post('/auth/confirm-code', { email: to, code: lastCode(to, 'register'), password });
    assert.equal(r.status, 200, r.text);
  }

  // ─── migration ─────────────────────────────────────────────────────────────

  it('migration: purpose column exists, nullable varchar(16)', async () => {
    const [col] = await ds.query(
      `SELECT data_type, character_maximum_length AS len, is_nullable FROM information_schema.columns
       WHERE table_name = 'password_reset_tokens' AND column_name = 'purpose'`,
    );
    assert.deepEqual({ ...col }, { data_type: 'character varying', len: 16, is_nullable: 'YES' });
  });

  it('codes are stored with their purpose', async () => {
    const to = email('purpose');
    await register(to, 'Passw0rd-one');
    await post('/auth/forgot-password', { email: to });
    const rows = await ds.query(
      `SELECT t.purpose FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
       WHERE u.email = $1 ORDER BY t.created_at`,
      [to],
    );
    assert.deepEqual(
      rows.map((r: Json) => r.purpose),
      ['register', 'reset'],
    );
  });

  // ─── F6 ────────────────────────────────────────────────────────────────────

  it('F6: pre-registered account → the mailbox owner’s password wins, attacker is locked out', async () => {
    const victim = email('victim');
    assert.equal((await register(victim, 'Attacker-pw1', { firstName: 'Чабуул' })).status, 201);
    const again = await register(victim, 'Victim-pw-22', { firstName: 'Айгүл', lastName: 'Асанова' });
    assert.equal(again.status, 200);
    assert.equal(again.data.needsConfirmation, true);

    const victimPhone = phone();
    const ok = await post('/auth/confirm-code', {
      email: victim,
      code: lastCode(victim, 'register'),
      password: 'Victim-pw-22',
      firstName: 'Айгүл',
      lastName: 'Асанова',
      phone: victimPhone,
    });
    assert.equal(ok.status, 200, ok.text);
    assert.ok(ok.data.token);

    assert.equal((await login(victim, 'Attacker-pw1')).status, 401);
    assert.equal((await login(victim, 'Victim-pw-22')).status, 200);

    const row = await userRow(victim);
    assert.equal(row.is_verified, true);
    assert.match(row.password_hash, /^\$2[aby]\$10\$/);
    assert.ok(!row.password_hash.includes('Victim-pw-22'));
    assert.equal(row.first_name, 'Айгүл');
    assert.equal(row.last_name, 'Асанова');
    assert.equal(row.phone, victimPhone);
  });

  it('F6: attacker re-registers after the victim → old code dead, victim confirms the latest with own password', async () => {
    const victim = email('race');
    await register(victim, 'Victim-pw-22');
    const firstCode = lastCode(victim, 'register');
    await register(victim, 'Attacker-pw1');
    const latest = lastCode(victim, 'register');
    assert.notEqual(firstCode, latest);

    assert.equal((await post('/auth/confirm-code', { email: victim, code: firstCode, password: 'Victim-pw-22' })).status, 400);
    assert.equal((await post('/auth/confirm-code', { email: victim, code: latest, password: 'Victim-pw-22' })).status, 200);
    assert.equal((await login(victim, 'Victim-pw-22')).status, 200);
    assert.equal((await login(victim, 'Attacker-pw1')).status, 401);
  });

  it('F6: phone taken by another account → 409, nothing changes and the code stays usable', async () => {
    const taken = phone();
    const owner = email('owner');
    assert.equal((await register(owner, 'Owner-pw-123', { phone: taken })).status, 201);
    const to = email('newbie');
    await register(to, 'Newbie-pw-12');
    const code = lastCode(to, 'register');

    const clash = await post('/auth/confirm-code', { email: to, code, password: 'Newbie-pw-12', phone: taken });
    assert.equal(clash.status, 409, clash.text);
    assert.equal((await userRow(to)).is_verified, false);

    assert.equal((await post('/auth/confirm-code', { email: to, code, password: 'Newbie-pw-12' })).status, 200);
  });

  it('F6: confirm-code requires a valid password; a rejected request does not use up the code', async () => {
    const to = email('nopw');
    await register(to, 'Start-pw-123');
    const code = lastCode(to, 'register');
    assert.equal((await post('/auth/confirm-code', { email: to, code })).status, 400);
    assert.equal((await post('/auth/confirm-code', { email: to, code, password: 'short' })).status, 400);
    assert.equal((await post('/auth/confirm-code', { email: to, code, password: 'nodigitshere' })).status, 400);
    assert.equal((await userRow(to)).is_verified, false);
    assert.equal((await post('/auth/confirm-code', { email: to, code, password: 'Final-pw-123' })).status, 200);
    assert.equal((await login(to, 'Final-pw-123')).status, 200);
  });

  it('F6: unverified login → resend-code sends a register code → confirm with password works', async () => {
    const to = email('later');
    await register(to, 'Later-pw-123');
    sent.length = 0;
    const blocked = await login(to, 'Later-pw-123');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.data.needsConfirmation, true);

    const resend = await post('/auth/resend-code', { email: to });
    assert.equal(resend.status, 200, resend.text);
    assert.deepEqual(
      sent.map((s) => s.kind),
      ['register'],
    );
    const ok = await post('/auth/confirm-code', { email: to, code: lastCode(to, 'register'), password: 'Later-pw-123' });
    assert.equal(ok.status, 200, ok.text);
  });

  it('F6: an already verified account cannot be confirmed again (no token, no password change)', async () => {
    const to = email('done');
    await verifiedUser(to, 'Done-pw-1234');
    sent.length = 0;
    assert.equal((await post('/auth/resend-code', { email: to })).status, 200);
    assert.equal(sent.length, 0, 'resend-code must not mail verified accounts');

    await register(to, 'Other-pw-123'); // 409: email taken, no code
    await post('/auth/forgot-password', { email: to });
    const reset = lastCode(to, 'reset');
    const r = await post('/auth/confirm-code', { email: to, code: reset, password: 'Hijack-pw-12' });
    assert.equal(r.status, 400);
    assert.equal(r.data.token, undefined);
    assert.equal((await login(to, 'Done-pw-1234')).status, 200);
    assert.equal((await login(to, 'Hijack-pw-12')).status, 401);
  });

  // ─── F15 ───────────────────────────────────────────────────────────────────

  it('F15: a password-reset code cannot confirm a registration', async () => {
    const to = email('f15a');
    await register(to, 'Reg-pw-12345');
    await post('/auth/forgot-password', { email: to });
    const r = await post('/auth/confirm-code', { email: to, code: lastCode(to, 'reset'), password: 'Reg-pw-12345' });
    assert.equal(r.status, 400);
    assert.equal(r.data.token, undefined);
    assert.equal((await userRow(to)).is_verified, false);
  });

  it('F15: a registration code cannot reset a password (and is not used up by the attempt)', async () => {
    const to = email('f15b');
    await register(to, 'Reg-pw-12345');
    const code = lastCode(to, 'register');
    const r = await post('/auth/reset-password', {
      email: to,
      token: code,
      password: 'New-pw-12345',
      confirmPassword: 'New-pw-12345',
    });
    assert.equal(r.status, 400);
    assert.equal((await post('/auth/confirm-code', { email: to, code, password: 'Reg-pw-12345' })).status, 200);
    assert.equal((await login(to, 'Reg-pw-12345')).status, 200);
    assert.equal((await login(to, 'New-pw-12345')).status, 401);
  });

  it('F15: legacy codes without a purpose are refused by both endpoints', async () => {
    const unverified = email('legacy-u');
    await register(unverified, 'Legacy-pw-12');
    const verified = email('legacy-v');
    await verifiedUser(verified, 'Legacy-pw-34');

    for (const [to, code] of [
      [unverified, '111111'],
      [verified, '222222'],
    ]) {
      await ds.query(
        `INSERT INTO password_reset_tokens (id, user_id, token, expires_at, used_at, created_at, purpose)
         SELECT gen_random_uuid(), id, $2, now() + interval '10 minutes', NULL, now(), NULL FROM users WHERE email = $1`,
        [to, code],
      );
      const c = await post('/auth/confirm-code', { email: to, code, password: 'Legacy-new-1' });
      assert.equal(c.status, 400, `confirm-code accepted a legacy code for ${to}`);
      const r = await post('/auth/reset-password', {
        email: to,
        token: code,
        password: 'Legacy-new-1',
        confirmPassword: 'Legacy-new-1',
      });
      assert.equal(r.status, 400, `reset-password accepted a legacy code for ${to}`);
    }
    assert.equal((await userRow(unverified)).is_verified, false);
    assert.equal((await login(verified, 'Legacy-pw-34')).status, 200);
  });

  it('reset code on an unverified account sets the password and verifies it (mailbox owner)', async () => {
    const to = email('reset-unverified');
    await register(to, 'Attacker-pw1');
    await post('/auth/forgot-password', { email: to });
    const r = await post('/auth/reset-password', {
      email: to,
      token: lastCode(to, 'reset'),
      password: 'Owner-pw-123',
      confirmPassword: 'Owner-pw-123',
    });
    assert.equal(r.status, 200, r.text);
    assert.equal((await userRow(to)).is_verified, true);
    assert.equal((await login(to, 'Owner-pw-123')).status, 200);
    assert.equal((await login(to, 'Attacker-pw1')).status, 401);
  });

  // ─── expiry, reuse, concurrency ────────────────────────────────────────────

  it('expired codes are refused (register and reset)', async () => {
    const a = email('exp-a');
    await register(a, 'Exp-pw-12345');
    const b = email('exp-b');
    await verifiedUser(b, 'Exp-pw-67890');
    await post('/auth/forgot-password', { email: b });
    await ds.query(`UPDATE password_reset_tokens SET expires_at = now() - interval '1 second' WHERE used_at IS NULL`);

    assert.equal(
      (await post('/auth/confirm-code', { email: a, code: lastCode(a, 'register'), password: 'Exp-pw-12345' })).status,
      400,
    );
    const r = await post('/auth/reset-password', {
      email: b,
      token: lastCode(b, 'reset'),
      password: 'Exp-new-1234',
      confirmPassword: 'Exp-new-1234',
    });
    assert.equal(r.status, 400);
    assert.equal((await login(b, 'Exp-pw-67890')).status, 200);
  });

  it('a code works only once (register and reset)', async () => {
    const to = email('once');
    await register(to, 'Once-pw-1234');
    const code = lastCode(to, 'register');
    assert.equal((await post('/auth/confirm-code', { email: to, code, password: 'Once-pw-1234' })).status, 200);
    assert.equal((await post('/auth/confirm-code', { email: to, code, password: 'Once-pw-5678' })).status, 400);

    await post('/auth/forgot-password', { email: to });
    const reset = lastCode(to, 'reset');
    const body = (pw: string) => ({ email: to, token: reset, password: pw, confirmPassword: pw });
    assert.equal((await post('/auth/reset-password', body('Reset-pw-111'))).status, 200);
    assert.equal((await post('/auth/reset-password', body('Reset-pw-222'))).status, 400);
    assert.equal((await login(to, 'Reset-pw-111')).status, 200);
  });

  it('parallel confirmations of one code: exactly one succeeds, its password is the one stored', async () => {
    const to = email('parallel');
    await register(to, 'Start-pw-123');
    const code = lastCode(to, 'register');
    const passwords = Array.from({ length: 8 }, (_, i) => `Par-pw-${i}xxxx`);
    const results = await Promise.all(
      passwords.map((password) => post('/auth/confirm-code', { email: to, code, password })),
    );
    const winners = results.flatMap((r, i) => (r.status === 200 ? [passwords[i]] : []));
    assert.equal(winners.length, 1, `statuses: ${results.map((r) => r.status).join(',')}`);
    assert.ok(results.every((r) => r.status === 200 || r.status === 400));
    assert.equal((await login(to, winners[0])).status, 200);
  });

  it('parallel password resets with one code: exactly one succeeds', async () => {
    const to = email('parallel-reset');
    await verifiedUser(to, 'Start-pw-123');
    await post('/auth/forgot-password', { email: to });
    const token = lastCode(to, 'reset');
    const passwords = Array.from({ length: 8 }, (_, i) => `Res-pw-${i}xxxx`);
    const results = await Promise.all(
      passwords.map((password) =>
        post('/auth/reset-password', { email: to, token, password, confirmPassword: password }),
      ),
    );
    const winners = results.flatMap((r, i) => (r.status === 200 ? [passwords[i]] : []));
    assert.equal(winners.length, 1, `statuses: ${results.map((r) => r.status).join(',')}`);
    assert.equal((await login(to, winners[0])).status, 200);
  });

  it('a new code revokes the older ones', async () => {
    const to = email('revoke');
    await register(to, 'Rev-pw-12345');
    const registerCode = lastCode(to, 'register');
    await post('/auth/forgot-password', { email: to });
    assert.equal((await post('/auth/confirm-code', { email: to, code: registerCode, password: 'Rev-pw-12345' })).status, 400);
  });

  it('another user’s code does not work for this email', async () => {
    const u1 = email('u1');
    const u2 = email('u2');
    await register(u1, 'User-pw-1111');
    await register(u2, 'User-pw-2222');
    const r = await post('/auth/confirm-code', { email: u1, code: lastCode(u2, 'register'), password: 'User-pw-1111' });
    assert.equal(r.status, 400);
    assert.equal((await userRow(u1)).is_verified, false);
  });

  // ─── errors leak nothing ───────────────────────────────────────────────────

  it('confirm-code errors are identical for wrong code / verified account / unknown email and echo no input', async () => {
    const unverified = email('leak-u');
    await register(unverified, 'Leak-pw-1234');
    const verified = email('leak-v');
    await verifiedUser(verified, 'Leak-pw-5678');
    const secretPw = 'Secret-pw-999';
    const bodies = await Promise.all([
      post('/auth/confirm-code', { email: unverified, code: '000000', password: secretPw }),
      post('/auth/confirm-code', { email: verified, code: '000000', password: secretPw }),
      post('/auth/confirm-code', { email: email('nobody'), code: '000000', password: secretPw }),
    ]);
    for (const b of bodies) {
      assert.equal(b.status, 400);
      assert.ok(!b.text.includes(secretPw), 'response echoes the password');
      assert.ok(!b.text.includes('000000'), 'response echoes the code');
      assert.ok(!b.text.includes('$2'), 'response contains a hash');
    }
    assert.equal(new Set(bodies.map((b) => b.text)).size, 1, 'responses differ between cases');
  });

  it('resend-code: identical neutral answer for unknown, verified and unverified emails; mails only the unverified', async () => {
    const unverified = email('rs-u');
    await register(unverified, 'Rs-pw-123456');
    const verified = email('rs-v');
    await verifiedUser(verified, 'Rs-pw-654321');
    sent.length = 0;
    const answers = [];
    for (const to of [email('rs-none'), verified, unverified]) answers.push(await post('/auth/resend-code', { email: to }));
    assert.ok(answers.every((a) => a.status === 200));
    assert.equal(new Set(answers.map((a) => a.text)).size, 1, 'answers reveal whether the account exists');
    assert.deepEqual(sent.map((s) => [s.to, s.kind]), [[unverified, 'register']]);
  });

  // ─── old frontend against the new backend ─────────────────────────────────

  it('old frontend: confirm without password is refused and does not verify or use up the code', async () => {
    const to = email('oldfe');
    await register(to, 'Old-fe-pw-12');
    const code = lastCode(to, 'register');
    assert.equal((await post('/auth/confirm-code', { email: to, code })).status, 400);
    assert.equal((await userRow(to)).is_verified, false);
    assert.equal((await post('/auth/confirm-code', { email: to, code, password: 'Old-fe-pw-12' })).status, 200);
  });

  it('old frontend fallback (resend via forgot-password) cannot confirm a registration on the new backend', async () => {
    const to = email('fallback');
    await register(to, 'Fb-pw-123456');
    await post('/auth/forgot-password', { email: to }); // what the old "resend" button calls
    const r = await post('/auth/confirm-code', { email: to, code: lastCode(to, 'reset'), password: 'Fb-pw-123456' });
    assert.equal(r.status, 400);
    assert.equal((await userRow(to)).is_verified, false);
  });

  // ─── R1: email only, never SMS ─────────────────────────────────────────────

  async function liveCodes(to: string) {
    const [{ n }] = await ds.query(
      `SELECT count(*)::int AS n FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
       WHERE lower(u.email) = lower($1) AND t.used_at IS NULL AND t.expires_at > now()`,
      [to],
    );
    return n as number;
  }

  async function codeRows(to: string) {
    return ds.query(
      `SELECT t.id, t.used_at FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
       WHERE lower(u.email) = lower($1) ORDER BY t.created_at, t.id`,
      [to],
    );
  }

  async function liveCodeValues(to: string) {
    const rows = await ds.query(
      `SELECT t.token FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
       WHERE lower(u.email) = lower($1) AND t.used_at IS NULL AND t.expires_at > now()`,
      [to],
    );
    return rows.map((r: Json) => r.token);
  }

  it('R1: with SMS configured and mail working, codes go by email only', async () => {
    const to = email('r1-ok');
    const reg = await register(to, 'R1-ok-pw-123');
    assert.equal(reg.status, 201);
    assert.doesNotMatch(reg.data.message, /SMS/);
    await post('/auth/resend-code', { email: to });
    const done = email('r1-ok-v');
    await verifiedUser(done, 'R1-ok-pw-456');
    await post('/auth/forgot-password', { email: done });
    assert.deepEqual(
      sent.map((s) => s.kind),
      ['register', 'register', 'register', 'reset'],
    );
    assert.deepEqual(smsSent, []);
  });

  it('R1: mail fails on a new registration → 503, no SMS, no account, no code left', async () => {
    mailFails = true;
    const to = email('r1-new');
    const r = await register(to, 'R1-new-pw-12', { phone: phone() });
    assert.equal(r.status, 503, r.text);
    assert.notEqual(r.data.needsConfirmation, true);
    assert.deepEqual(smsSent, []);
    assert.equal(await userRow(to), undefined);
    assert.equal(await liveCodes(to), 0);
  });

  it('R1/F6: attacker pre-registers with own phone; when mail fails nothing reaches that phone', async () => {
    const victim = email('r1-victim');
    const attackerPhone = phone();
    assert.equal((await register(victim, 'Attacker-pw1', { phone: attackerPhone })).status, 201);
    mailFails = true;

    const again = await register(victim, 'Victim-pw-22');
    assert.equal(again.status, 503, again.text);
    const resend = await post('/auth/resend-code', { email: victim });
    assert.equal(resend.status, 503, resend.text);

    assert.deepEqual(smsSent, [], 'a registration code went to the unverified phone');
    assert.equal(await liveCodes(victim), 0, 'a usable code was left behind');
    assert.equal((await userRow(victim)).is_verified, false);
    assert.equal((await login(victim, 'Attacker-pw1')).status, 403);
  });

  it('R1: resend-code when mail fails → 503 (no false success), no SMS, no live code', async () => {
    const to = email('r1-resend');
    await register(to, 'R1-rs-pw-123');
    mailFails = true;
    const r = await post('/auth/resend-code', { email: to });
    assert.equal(r.status, 503, r.text);
    assert.deepEqual(smsSent, []);
    assert.equal(await liveCodes(to), 0);
  });

  it('R1: forgot-password when mail fails → 503, no SMS, no live code, password unchanged', async () => {
    const to = email('r1-forgot');
    await verifiedUser(to, 'R1-fg-pw-123');
    mailFails = true;
    const r = await post('/auth/forgot-password', { email: to });
    assert.equal(r.status, 503, r.text);
    assert.deepEqual(smsSent, []);
    assert.equal(await liveCodes(to), 0);
    assert.equal((await login(to, 'R1-fg-pw-123')).status, 200);
  });

  it('R1: mail not configured at all (SMS configured) → register / resend / forgot all 503, nothing by SMS', async () => {
    const pending = email('r1-nomail-u');
    await register(pending, 'R1-nm-pw-123');
    const done = email('r1-nomail-v');
    await verifiedUser(done, 'R1-nm-pw-456');
    const emailedEarlier = lastCode(pending, 'register'); // delivered while mail still worked
    const codesBefore = await codeRows(pending);
    mailConfigured = false;

    const fresh = email('r1-nomail-new');
    assert.equal((await register(fresh, 'R1-nm-pw-789')).status, 503);
    assert.equal(await userRow(fresh), undefined);
    assert.equal((await post('/auth/resend-code', { email: pending })).status, 503);
    assert.equal((await post('/auth/forgot-password', { email: done })).status, 503);
    assert.deepEqual(smsSent, []);
    // No code was created while mail was down; the only usable one is the code that really
    // reached the mailbox earlier.
    assert.deepEqual(await codeRows(pending), codesBefore);
    assert.deepEqual(await liveCodeValues(pending), [emailedEarlier]);
    assert.equal(await liveCodes(done), 0);
  });

  it('R1: after mail recovers, registration and reset work normally again', async () => {
    const to = email('r1-recover');
    mailFails = true;
    assert.equal((await register(to, 'R1-rc-pw-123')).status, 503);
    mailFails = false;
    assert.equal((await register(to, 'R1-rc-pw-123')).status, 201);
    const ok = await post('/auth/confirm-code', { email: to, code: lastCode(to, 'register'), password: 'R1-rc-pw-123' });
    assert.equal(ok.status, 200, ok.text);
    await post('/auth/forgot-password', { email: to });
    const r = await post('/auth/reset-password', {
      email: to,
      token: lastCode(to, 'reset'),
      password: 'R1-rc-pw-456',
      confirmPassword: 'R1-rc-pw-456',
    });
    assert.equal(r.status, 200, r.text);
    assert.equal((await login(to, 'R1-rc-pw-456')).status, 200);
    assert.deepEqual(smsSent, []);
  });

  // ─── regression ────────────────────────────────────────────────────────────

  it('regression: register → confirm → login → /auth/me', async () => {
    const to = email('happy');
    const reg = await register(to, 'Happy-pw-123');
    assert.equal(reg.status, 201);
    assert.equal(reg.data.needsConfirmation, true);
    const ok = await post('/auth/confirm-code', { email: to, code: lastCode(to, 'register'), password: 'Happy-pw-123' });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.user.email, to);
    const me = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${ok.data.token}` } });
    assert.equal(me.status, 200);
    assert.equal((await login(to, 'Happy-pw-123')).status, 200);
  });

  it('regression: forgot → reset → login with the new password only', async () => {
    const to = email('forgot');
    await verifiedUser(to, 'Before-pw-12');
    assert.equal((await post('/auth/forgot-password', { email: to })).status, 200);
    const r = await post('/auth/reset-password', {
      email: to,
      token: lastCode(to, 'reset'),
      password: 'After-pw-123',
      confirmPassword: 'After-pw-123',
    });
    assert.equal(r.status, 200, r.text);
    assert.equal((await login(to, 'After-pw-123')).status, 200);
    assert.equal((await login(to, 'Before-pw-12')).status, 401);
  });
});
