/**
 * QA F6 + F15 — registration / password-reset codes, against a real PostgreSQL test database.
 *
 * F6:  an unverified account pre-registered with someone else's email must end up with the
 *      password chosen by whoever confirms the emailed code (the mailbox owner).
 * F15: a code issued for password reset must not confirm a registration and vice versa;
 *      codes without a recorded purpose are refused; every code works at most once.
 *
 * Needs the isolated, disposable database `mualim_auth_clean_test` on 127.0.0.1:5433, reached as
 * the role `mualim_auth_it` (no other database, role, host or port is accepted) — every run
 * wipes its users — and a fresh
 * build (Nest DI needs decorator metadata, which tsx does not emit):
 *
 * The database must be owned by an admin role — not by mualim_auth_it, so the test role cannot
 * set the marker below itself — and marked disposable once by that admin (see TEST_DB_MARKER):
 *   COMMENT ON DATABASE mualim_auth_clean_test IS 'mualim-auth-integration-test: disposable, wiped on every run';
 * Optionally AUTH_TEST_DB_OWNER=<that admin role> makes the run require exactly that owner.
 *
 *   npm run build:server
 *   read -rs PGPASSWORD && export PGPASSWORD      # the password never goes into the URL
 *   AUTH_TEST_DATABASE_URL=postgresql://mualim_auth_it@127.0.0.1:5433/mualim_auth_clean_test \
 *   TSX_TSCONFIG_PATH=server/tsconfig.json node --import tsx --test server/test/auth-codes.integration.test.ts
 *
 * R1: codes are emailed only. SMS is mocked as *configured* and must never be used —
 *     the phone on an account is unverified and chosen by whoever registered it.
 * Also: registration validation, login failures, duplicate verified email (409) and the
 *     per-IP rate limits (429).
 * F14: forgot-password answers every address the same way (unknown, verified, unverified,
 *     inactive, admin); the code is issued and emailed in the background, an unsent code is
 *     revoked and the failure is logged without the address or the code.
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
/** Optional: the admin role that must own the test database. Unset, any owner other than the
 * test role is accepted; no owner name is assumed here. */
const DB_OWNER = process.env.AUTH_TEST_DB_OWNER;
const SERVER = resolve(__dirname, '..');
const DIST = resolve(SERVER, 'dist');

/** The only database, role and server these tests may use (and wipe) — not mualim,
 * mualim_auth_test, mualim_e2e_test or any other. */
const TEST_DB_NAME = 'mualim_auth_clean_test';
const TEST_DB_USER = 'mualim_auth_it';
const TEST_DB_HOST = '127.0.0.1';
const TEST_DB_PORT = '5433';

/** Connection settings pg reads from the environment (pg/lib/connection-parameters.js). The
 * password variables (PGPASSWORD, PGPASSFILE) are kept on purpose. */
const PG_ENV_OVERRIDES = [
  'PGHOST',
  'PGPORT',
  'PGUSER',
  'PGDATABASE',
  'PGOPTIONS',
  'PGREPLICATION',
  'PGSSLMODE',
  'PGSSLNEGOTIATION',
  'PGCLIENT_ENCODING',
  'PGBINARY',
  'PGAPPNAME',
];

/** Set once by the admin role that owns the test database — `COMMENT ON DATABASE
 * mualim_auth_clean_test IS '<this text>'` — so a database is wiped only if someone deliberately
 * marked it disposable. Only the database owner (or a superuser) can set it, which is why the
 * owner must not be the test role; the tests never set it themselves. */
const TEST_DB_MARKER = 'mualim-auth-integration-test: disposable, wiped on every run';

/** Tables the tests never write. In a disposable test database they are empty; rows there
 * mean the database holds data worth keeping (TRUNCATE users CASCADE would wipe them). */
const MUST_BE_EMPTY = [
  'qa_articles',
  'teacher_question_submissions',
  'reviews',
  'payments',
  'certificates',
  'enrollments',
  'course_progress',
  'lesson_progress',
  'test_attempts',
  'test_answers',
];

/** Every account the tests create uses this domain (see `email()` below); leftovers from an
 * interrupted run are fine, anyone else is not. */
const TEST_EMAIL_DOMAIN = '@test.local';

/** Fails without ever quoting the URL or any part of it. */
function refuse(why: string): never {
  throw new Error(`refusing AUTH_TEST_DATABASE_URL: ${why}`);
}

/** Checks AUTH_TEST_DATABASE_URL before anything connects. Nothing is decoded: names are
 * compared as written, so the check cannot read the URL differently from pg. */
function assertSafeTestDatabase(url: string) {
  // new URL() silently drops surrounding spaces/control characters (and tabs/newlines anywhere),
  // while pg-connection-string re-encodes such input and reads it differently — so only plain
  // printable ASCII is accepted, with no '%' or '\', and no '?' or '#' at all (not even a bare
  // one: href keeps an empty '?' / '#', so the canonical-form check below would not catch it).
  if (!/^[\x21-\x7e]+$/.test(url) || /[%\\?#]/.test(url)) {
    return refuse('only printable ASCII without spaces, control characters, %, \\, ? or # is allowed');
  }
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return refuse('not a valid URL'); // Node's own error would carry the whole URL in err.input
  }
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') refuse('not a postgres:// URL');
  if (u.hostname !== TEST_DB_HOST) refuse(`host must be ${TEST_DB_HOST}`);
  if (u.port !== TEST_DB_PORT) refuse(`port must be ${TEST_DB_PORT}`);
  if (u.pathname !== `/${TEST_DB_NAME}`) refuse(`database must be ${TEST_DB_NAME}`);
  if (u.username !== TEST_DB_USER) refuse(`user must be ${TEST_DB_USER}`);
  if (u.password !== '') refuse('put the password in PGPASSWORD, not in the URL');
  // pg-connection-string turns query parameters into settings (?host= replaces the host,
  // ?options= can change search_path or role, ?sslkey= reads files) — none are allowed.
  if (u.search !== '' || u.hash !== '') refuse('query parameters are not allowed');
  // Any other spelling the parser normalises (upper-case scheme, port 05433, an empty password
  // `user:@`) is refused too, so the checked text is exactly the text pg parses.
  if (u.href !== url) refuse('the URL must be written in canonical form');
}

/** Read-only identity check on the live connection; any failure stops the run before `ds`
 * is set, so nothing is altered or truncated. Messages name only the expected values. */
async function assertSafeConnection(connection: { query: (sql: string) => Promise<any[]> }) {
  const [who] = await connection.query(
    `SELECT current_database() AS db, current_user AS usr, session_user AS sess,
            current_schema() AS schema, inet_server_port() AS port, host(inet_server_addr()) AS addr,
            r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls,
            (SELECT count(*)::int FROM pg_auth_members m WHERE m.member = r.oid) AS memberships,
            shobj_description(d.oid, 'pg_database') AS marker,
            pg_get_userbyid(d.datdba) AS db_owner
       FROM pg_roles r JOIN pg_database d ON d.datname = current_database()
      WHERE r.rolname = session_user`,
  );
  const fail = (why: string): never => {
    throw new Error(`refusing the test connection: ${why}`);
  };
  if (!who) fail('could not read the connection identity');
  if (who.db !== TEST_DB_NAME) fail(`database must be ${TEST_DB_NAME}`);
  if (who.usr !== TEST_DB_USER || who.sess !== TEST_DB_USER) fail(`role must be ${TEST_DB_USER}`);
  if (who.schema !== 'public') fail('current schema must be public');
  if (String(who.port) !== TEST_DB_PORT) fail(`server port must be ${TEST_DB_PORT}`);
  if (who.addr !== TEST_DB_HOST) fail(`server address must be ${TEST_DB_HOST}`);
  if (who.rolsuper || who.rolcreatedb || who.rolcreaterole || who.rolreplication || who.rolbypassrls) {
    fail(`${TEST_DB_USER} must have no admin attributes`);
  }
  if (who.memberships !== 0) fail(`${TEST_DB_USER} must not be a member of other roles`);

  // The right name is not enough: the database must be marked disposable and hold nothing that
  // the tests did not create themselves (read-only checks, still before `ds` is set).
  // The marker means something only if the test role could not have set it: the database must be
  // owned by another role (COMMENT ON DATABASE needs the owner), and by exactly AUTH_TEST_DB_OWNER
  // when that is configured.
  if (typeof who.db_owner !== 'string' || who.db_owner === '') fail('could not read the database owner');
  if (who.db_owner === TEST_DB_USER || who.db_owner === who.sess) {
    fail(`${TEST_DB_NAME} must be owned by an admin role, not by ${TEST_DB_USER}`);
  }
  if (DB_OWNER !== undefined) {
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(DB_OWNER) || DB_OWNER === TEST_DB_USER) {
      fail('AUTH_TEST_DB_OWNER must be a plain role name other than the test role');
    }
    if (who.db_owner !== DB_OWNER) fail(`${TEST_DB_NAME} must be owned by the role set in AUTH_TEST_DB_OWNER`);
  }
  if (who.marker !== TEST_DB_MARKER) fail(`${TEST_DB_NAME} is not marked as a disposable test database`);
  let contents: Record<string, number> | undefined;
  try {
    [contents] = await connection.query(
      `SELECT ${MUST_BE_EMPTY.map((t) => `(SELECT count(*)::int FROM public.${t}) AS ${t}`).join(', ')},
              (SELECT count(*)::int FROM public.users WHERE email NOT LIKE '%${TEST_EMAIL_DOMAIN}') AS other_users`,
    );
  } catch {
    fail('could not inspect the test tables (is the schema loaded?)');
  }
  if (!contents) return fail('could not inspect the test tables');
  const counts = contents;
  const notEmpty = MUST_BE_EMPTY.filter((t) => counts[t] !== 0);
  if (notEmpty.length > 0) fail(`not a disposable database: ${notEmpty.join(', ')} must be empty`);
  if (counts.other_users !== 0) fail(`not a disposable database: only ${TEST_EMAIL_DOMAIN} users may exist`);
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
  let mailDelayMs = 0;
  /** Codes the mail mock was asked to send while failing — they never reached anyone. */
  const unsent: SentCode[] = [];
  /** Everything AuthService logged during a case. */
  const authLogs: string[] = [];
  let authService: any;
  let ipCounter = 0;
  let phoneCounter = 0;

  before(async () => {
    assertSafeTestDatabase(DB_URL!);
    assertFreshBuild();
    for (const name of PG_ENV_OVERRIDES) delete process.env[name]; // `= undefined` would set "undefined"
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
    const { AuthService } = require(resolve(DIST, 'auth/auth.service.js'));
    const { ensureAuthCodeColumns } = require(resolve(DIST, 'database/bootstrap-schema.js'));

    // abortOnError: false — a failed start (e.g. no connection) is thrown here instead of Nest
    // calling process.exit(1), so the run fails normally.
    app = await NestFactory.create(AppModule, { bodyParser: false, logger: false, abortOnError: false });
    // Before this point only TypeORM's read-only startup queries ran (version, current database,
    // current schema). `ds` — used by every later statement and by the cleanup hooks — is set
    // only after the identity check; if it fails, after() just closes the app.
    const connection = app.get(DataSource);
    await assertSafeConnection(connection);
    ds = connection;

    // Startup migration: adds the column to the pre-change schema; must be repeatable.
    await ensureAuthCodeColumns(ds);
    await ensureAuthCodeColumns(ds);

    const mail = app.get(MailService);
    mail.isConfigured = () => mailConfigured;
    mail.sendAuthCode = async (to: string, code: string, kind: 'register' | 'reset') => {
      if (mailDelayMs) await new Promise((r) => setTimeout(r, mailDelayMs));
      if (mailFails) {
        unsent.push({ to, code, kind });
        throw new Error(`SMTP_REJECTED ${to}`); // like nodemailer: the error names the address
      }
      sent.push({ to, code, kind });
    };
    authService = app.get(AuthService);
    authService.logger = {
      log: (m: string) => authLogs.push(m),
      warn: (m: string) => authLogs.push(m),
      error: (m: string) => authLogs.push(m),
      debug: (m: string) => authLogs.push(m),
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
    await authService?.settleBackgroundTasks();
    if (ds) await ds.query('TRUNCATE users CASCADE');
    await app?.close();
    assert.equal(smsEverSent, 0, 'an auth code was sent by SMS during the run');
  });

  beforeEach(async () => {
    assert.ok(ds, `${TEST_DB_NAME} was not verified — refusing to truncate`);
    await authService.settleBackgroundTasks();
    await ds.query('TRUNCATE users CASCADE');
    sent.length = 0;
    smsSent.length = 0;
    unsent.length = 0;
    authLogs.length = 0;
    mailConfigured = true;
    mailFails = false;
    mailDelayMs = 0;
  });

  /** Each request gets its own client IP so the per-IP throttler never interferes —
   * unless a fixed `ip` is given (rate-limit tests). */
  async function post(path: string, body: Json, token?: string, ip?: string, lang = 'ky') {
    ipCounter += 1;
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': lang,
        'CF-Connecting-IP': ip ?? `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`,
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
    return { status: res.status, data, text, headers: res.headers };
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

  /** forgot-password, then wait for the background issue-and-email work to finish. */
  async function forgot(to: string, opts: { ip?: string; lang?: string } = {}) {
    const r = await post('/auth/forgot-password', { email: to }, undefined, opts.ip, opts.lang);
    await authService.settleBackgroundTasks();
    return r;
  }

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
    await forgot(to);
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
    await forgot(to);
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
    await forgot(to);
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
    await forgot(to);
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
    await forgot(b);
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

    await forgot(to);
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
    await forgot(to);
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
    await forgot(to);
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
    const answers: Awaited<ReturnType<typeof post>>[] = [];
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
    await forgot(to); // what the old "resend" button calls
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
    await forgot(done);
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

  it('R1/F14: forgot-password when mail fails → neutral 200, no SMS, no live code, failure logged, password unchanged', async () => {
    const to = email('r1-forgot');
    await verifiedUser(to, 'R1-fg-pw-123');
    mailFails = true;
    const r = await forgot(to);
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(smsSent, []);
    assert.equal(await liveCodes(to), 0);
    assert.ok(authLogs.some((m) => m.includes('reset code not delivered, revoked')), authLogs.join('\n'));
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
    assert.equal((await forgot(done)).status, 503);
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
    await forgot(to);
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

  // ─── registration validation ───────────────────────────────────────────────

  /** A request rejected by validation: 400 with the field error, no account, no code mailed. */
  async function assertRejectedRegistration(body: Json, field: string, label: string) {
    const before = sent.length;
    const r = await post('/auth/register', body);
    assert.equal(r.status, 400, `${label}: ${r.text}`);
    assert.ok(r.data.fields?.[field], `${label}: no fields.${field} in ${r.text}`);
    if (typeof body.email === 'string' && body.email.includes('@')) {
      assert.equal(await userRow(body.email.trim().toLowerCase()), undefined, `${label}: account was created`);
    }
    assert.equal(sent.length, before, `${label}: a code was mailed`);
  }

  const validRegistration = () => ({
    firstName: 'Аты',
    lastName: 'Фамилия',
    email: email('valid'),
    phone: phone(),
    password: 'Valid-pw-123',
  });

  it('registration: invalid email formats → 400 fields.email, nothing created', async () => {
    for (const bad of ['abc', 'a@b', 'a@b.c', 'a b@c.kg', '', '   ']) {
      await assertRejectedRegistration({ ...validRegistration(), email: bad }, 'email', `email "${bad}"`);
    }
  });

  it('registration: each required field missing → 400 for that field', async () => {
    for (const field of ['firstName', 'lastName', 'email', 'phone', 'password']) {
      const body: Json = validRegistration();
      delete body[field];
      await assertRejectedRegistration(body, field, `missing ${field}`);
    }
  });

  it('registration: weak passwords → 400 fields.password; 8 chars with a letter and a digit is accepted', async () => {
    for (const [label, pw] of [
      ['7 chars', 'Abcde1x'],
      ['no digit', 'Abcdefghij'],
      ['no letter', '1234567890'],
      ['129 chars', `${'a1'.repeat(64)}x`],
    ]) {
      await assertRejectedRegistration({ ...validRegistration(), password: pw }, 'password', `password ${label}`);
    }
    const ok = await post('/auth/register', { ...validRegistration(), password: 'Abcdefg1' });
    assert.equal(ok.status, 201, ok.text);
  });

  it('registration: invalid phone and names → 400 for that field', async () => {
    await assertRejectedRegistration({ ...validRegistration(), phone: '12345' }, 'phone', 'phone 12345');
    await assertRejectedRegistration({ ...validRegistration(), firstName: 'Ali123' }, 'firstName', 'name with digits');
    await assertRejectedRegistration({ ...validRegistration(), firstName: '   ' }, 'firstName', 'blank first name');
    await assertRejectedRegistration({ ...validRegistration(), lastName: 'A' }, 'lastName', '1-letter last name');
  });

  // ─── login failures ────────────────────────────────────────────────────────

  it('login: unknown email and wrong password → 401 with identical bodies, no token', async () => {
    const to = email('login-known');
    await verifiedUser(to, 'Known-pw-123');
    const wrong = await login(to, 'Wrong-pw-123');
    const unknown = await login(email('login-nobody'), 'Wrong-pw-123');
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.text, unknown.text, 'the answer reveals whether the email exists');
    assert.equal(wrong.data.token, undefined);
    assert.ok(!wrong.text.includes('Wrong-pw-123') && !wrong.text.includes('$2'));
    assert.equal((await login(to.toUpperCase(), 'Known-pw-123')).status, 200, 'email must be case-insensitive');
  });

  it('login: unverified account — wrong password gives the same 401, right password 403 needsConfirmation', async () => {
    const to = email('login-unverified');
    await register(to, 'Unver-pw-123');
    const wrong = await login(to, 'Wrong-pw-123');
    const unknown = await login(email('login-nobody2'), 'Wrong-pw-123');
    assert.equal(wrong.status, 401);
    assert.equal(wrong.text, unknown.text, 'unverified state leaks on a wrong password');
    const right = await login(to, 'Unver-pw-123');
    assert.equal(right.status, 403);
    assert.equal(right.data.needsConfirmation, true);
    assert.equal(right.data.token, undefined);
  });

  it('login: malformed email / empty password → 400 field errors', async () => {
    const a = await login('not-an-email', 'Some-pw-123');
    assert.equal(a.status, 400);
    assert.ok(a.data.fields?.email);
    const b = await login(email('login-empty'), '');
    assert.equal(b.status, 400);
    assert.ok(b.data.fields?.password);
  });

  // ─── duplicate verified email ──────────────────────────────────────────────

  it('registration with an already verified email → 409 fields.email; account, password and mail untouched', async () => {
    const to = email('dup');
    await verifiedUser(to, 'Dup-pw-1234');
    const before = await userRow(to);
    sent.length = 0;
    for (const variant of [to, to.toUpperCase(), `  ${to}  `]) {
      const r = await register(variant, 'Other-pw-123', { firstName: 'Башка' });
      assert.equal(r.status, 409, `${variant}: ${r.text}`);
      assert.ok(r.data.fields?.email);
    }
    assert.equal(sent.length, 0, 'a code was mailed for a verified email');
    const after = await userRow(to);
    assert.deepEqual(after, before, 'the verified account changed');
    assert.equal((await login(to, 'Dup-pw-1234')).status, 200);
    assert.equal((await login(to, 'Other-pw-123')).status, 401);
  });

  // ─── rate limits (per client IP) ───────────────────────────────────────────

  it('rate limit: resend-code allows 5 requests per minute per IP, the 6th gets 429 (other IPs unaffected)', async () => {
    const ip = '10.250.0.1';
    const statuses: number[] = [];
    let last: Awaited<ReturnType<typeof post>> | undefined;
    for (let i = 0; i < 6; i += 1) {
      last = await post('/auth/resend-code', { email: email('rl') }, undefined, ip);
      statuses.push(last.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
    assert.ok(last!.headers.get('retry-after') ?? last!.headers.get('retry-after-default'), 'no Retry-After header');
    assert.ok(!/@|\$2|\d{6}/.test(last!.text), `429 body leaks data: ${last!.text}`);
    assert.equal((await post('/auth/resend-code', { email: email('rl') }, undefined, '10.250.0.2')).status, 200);
  });

  it('rate limit: login allows 10 attempts per minute per IP, the 11th gets 429 even with the right password', async () => {
    const to = email('rl-login');
    await verifiedUser(to, 'Rl-login-123');
    const ip = '10.250.1.1';
    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      statuses.push((await post('/auth/login', { email: to, password: 'Wrong-pw-123' }, undefined, ip)).status);
    }
    const eleventh = await post('/auth/login', { email: to, password: 'Rl-login-123' }, undefined, ip);
    assert.deepEqual(statuses, Array(10).fill(401));
    assert.equal(eleventh.status, 429);
    assert.equal(eleventh.data.token, undefined);
    assert.equal((await post('/auth/login', { email: to, password: 'Rl-login-123' }, undefined, '10.250.1.2')).status, 200);
  });

  it('rate limit: register allows 5 requests per minute per IP, the 6th gets 429 and creates nothing', async () => {
    const ip = '10.250.2.1';
    const statuses: number[] = [];
    let sixth = '';
    for (let i = 0; i < 6; i += 1) {
      const body = validRegistration();
      if (i === 5) sixth = body.email;
      statuses.push((await post('/auth/register', body, undefined, ip)).status);
    }
    assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
    assert.equal(await userRow(sixth), undefined, 'the throttled registration created an account');
  });

  // ─── F14: forgot-password does not reveal whether an account exists ──────

  /** One address of each kind: unknown, verified, unverified, inactive and admin. */
  async function fiveKinds() {
    const kinds = {
      unknown: email('f14-unknown'),
      verified: email('f14-verified'),
      unverified: email('f14-unverified'),
      inactive: email('f14-inactive'),
      admin: email('f14-admin'),
    };
    await verifiedUser(kinds.verified, 'F14-pw-12345');
    await register(kinds.unverified, 'F14-pw-12345');
    await verifiedUser(kinds.inactive, 'F14-pw-12345');
    await ds.query('UPDATE users SET is_active = false WHERE email = $1', [kinds.inactive]);
    await verifiedUser(kinds.admin, 'F14-pw-12345');
    await ds.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [kinds.admin]);
    await authService.settleBackgroundTasks();
    sent.length = 0;
    return kinds;
  }

  async function liveResetCodes(to: string) {
    const [{ n }] = await ds.query(
      `SELECT count(*)::int AS n FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
       WHERE lower(u.email) = lower($1) AND t.purpose = 'reset' AND t.used_at IS NULL AND t.expires_at > now()`,
      [to],
    );
    return n as number;
  }

  it('F14: identical status and body for unknown, verified, unverified, inactive and admin (ky and ru)', async () => {
    const kinds = await fiveKinds();
    for (const lang of ['ky', 'ru']) {
      sent.length = 0;
      const answers: Record<string, { status: number; text: string }> = {};
      for (const [kind, to] of Object.entries(kinds)) answers[kind] = await forgot(to, { lang });
      const distinct = new Set(Object.values(answers).map((a) => `${a.status} ${a.text}`));
      assert.equal(distinct.size, 1, `${lang}: answers differ: ${JSON.stringify(answers)}`);
      assert.equal(answers.unknown.status, 200);
      assert.ok(!/fields|error|token|\$2/.test(answers.unknown.text), answers.unknown.text);
      // Mail goes only to the two accounts that may reset a password.
      assert.deepEqual(sent.map((m) => m.to).sort(), [kinds.unverified, kinds.verified].sort(), lang);
      assert.ok(sent.every((m) => m.kind === 'reset'));
    }
    assert.equal(await liveResetCodes(kinds.verified), 1);
    assert.equal(await liveResetCodes(kinds.unverified), 1);
    assert.equal(await liveResetCodes(kinds.inactive), 0);
    assert.equal(await liveResetCodes(kinds.admin), 0);
  });

  it('F14: mail failing → the same 200 for all five; no usable code left; failure logged without address or code', async () => {
    const kinds = await fiveKinds();
    mailFails = true;
    const answers: Awaited<ReturnType<typeof post>>[] = [];
    for (const to of Object.values(kinds)) answers.push(await forgot(to));
    assert.equal(new Set(answers.map((a) => `${a.status} ${a.text}`)).size, 1, 'answers differ');
    assert.equal(answers[0].status, 200);

    assert.deepEqual(unsent.map((m) => m.to).sort(), [kinds.unverified, kinds.verified].sort());
    for (const to of Object.values(kinds)) assert.equal(await liveResetCodes(to), 0, `${to} has a live reset code`);
    // The code that was generated but never delivered does not work.
    for (const m of unsent) {
      const r = await post('/auth/reset-password', {
        email: m.to,
        token: m.code,
        password: 'Never-used-12',
        confirmPassword: 'Never-used-12',
      });
      assert.equal(r.status, 400, `unsent code for ${m.to} was accepted`);
    }
    assert.equal(authLogs.filter((l) => l.includes('reset code not delivered, revoked (user ')).length, 2);
    const logText = authLogs.join('\n');
    for (const to of Object.values(kinds)) assert.ok(!logText.includes(to), `log contains the address ${to}`);
    for (const m of unsent) assert.ok(!logText.includes(m.code), 'log contains an OTP code');
    // A5: the SMTP error names the address, but only a fixed tag is logged — no address at all.
    assert.ok(logText.includes('reset code not delivered (SMTP_REJECTED)'), logText);
    assert.ok(!logText.includes('@') && !logText.includes('test.local'), `log contains an address: ${logText}`);
  });

  it('F14: mail not configured → the same 503 for all five, no code issued, nothing in the background', async () => {
    const kinds = await fiveKinds();
    mailConfigured = false;
    const answers: Awaited<ReturnType<typeof post>>[] = [];
    for (const to of Object.values(kinds)) answers.push(await forgot(to));
    assert.equal(new Set(answers.map((a) => `${a.status} ${a.text}`)).size, 1, 'answers differ');
    assert.equal(answers[0].status, 503);
    assert.deepEqual(sent, []);
    for (const to of Object.values(kinds)) assert.equal(await liveResetCodes(to), 0);
  });

  it('F14: the answer does not wait for the email (timing does not depend on the account)', async () => {
    const kinds = await fiveKinds();
    mailDelayMs = 400;
    const started = Date.now();
    const r = await post('/auth/forgot-password', { email: kinds.verified });
    const answeredIn = Date.now() - started;
    assert.equal(r.status, 200);
    assert.ok(answeredIn < 300, `answered after ${answeredIn} ms — it waited for the email`);
    assert.equal(sent.length, 0, 'mail already sent before the answer');
    await authService.settleBackgroundTasks();
    assert.deepEqual(sent.map((m) => m.to), [kinds.verified]);
    const reset = await post('/auth/reset-password', {
      email: kinds.verified,
      token: lastCode(kinds.verified, 'reset'),
      password: 'After-f14-123',
      confirmPassword: 'After-f14-123',
    });
    assert.equal(reset.status, 200, reset.text);
  });

  it('F14: rate limit unchanged — 5 forgot-password requests per minute per IP, the 6th gets 429 for any address', async () => {
    const kinds = await fiveKinds();
    const ip = '10.250.3.1';
    const statuses: number[] = [];
    for (const to of [...Object.values(kinds), kinds.unknown]) statuses.push((await forgot(to, { ip })).status);
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
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
    assert.equal((await forgot(to)).status, 200);
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
