/**
 * QA ENV-1: `MAIL_TRANSPORT=log` lets local development and QA run without sending real email
 * (auth codes go to the server log). It must never be possible in production.
 *
 * Run (no extra packages — Node's built-in runner + the repo's existing tsx):
 *   TSX_TSCONFIG_PATH=server/tsconfig.json node --import tsx --test server/test/mail-transport.test.ts
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { resolveMailTransport } from '../src/mail/mail-transport';
import { MailService } from '../src/mail/mail.service';

describe('resolveMailTransport()', () => {
  it('defaults to smtp', () => {
    assert.equal(resolveMailTransport({}), 'smtp');
    assert.equal(resolveMailTransport({ MAIL_TRANSPORT: '' }), 'smtp');
    assert.equal(resolveMailTransport({ MAIL_TRANSPORT: 'smtp', NODE_ENV: 'production' }), 'smtp');
  });

  it('allows log outside production (case/space-insensitive)', () => {
    assert.equal(resolveMailTransport({ MAIL_TRANSPORT: 'log' }), 'log');
    assert.equal(resolveMailTransport({ MAIL_TRANSPORT: ' LOG ', NODE_ENV: 'development' }), 'log');
    assert.equal(resolveMailTransport({ MAIL_TRANSPORT: 'log', NODE_ENV: 'test' }), 'log');
  });

  it('refuses log when NODE_ENV=production', () => {
    for (const value of ['log', 'LOG', ' log ']) {
      assert.throws(
        () => resolveMailTransport({ MAIL_TRANSPORT: value, NODE_ENV: 'production' }),
        /MAIL_TRANSPORT=log is not allowed in production/,
      );
    }
  });

  it('refuses unknown values everywhere', () => {
    for (const NODE_ENV of ['production', 'development', undefined]) {
      assert.throws(
        () => resolveMailTransport({ MAIL_TRANSPORT: 'sendgrid', NODE_ENV }),
        /MAIL_TRANSPORT must be "smtp" or "log"/,
      );
    }
  });
});

describe('MailService with MAIL_TRANSPORT', () => {
  const saved = { ...process.env };
  let logs: string[];
  let service: MailService;

  function makeService() {
    const svc = new MailService();
    const svcAny = svc as any;
    svcAny.createTransport = () => {
      throw new Error('SMTP must not be used');
    };
    svcAny.logger = {
      log: (m: string) => logs.push(m),
      warn: (m: string) => logs.push(m),
      debug: (m: string) => logs.push(m),
      error: (m: string) => logs.push(m),
    };
    return svc;
  }

  beforeEach(() => {
    logs = [];
    for (const k of Object.keys(process.env)) if (/^(SMTP_|MAIL_TRANSPORT|NODE_ENV)/.test(k)) delete process.env[k];
    service = makeService();
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  });

  it('log (development, no SMTP): configured, code is logged, SMTP never touched', async () => {
    process.env.MAIL_TRANSPORT = 'log';
    process.env.NODE_ENV = 'development';
    assert.equal(service.isConfigured(), true);
    await service.sendAuthCode('dev@test.local', '123456', 'register');
    assert.ok(logs.some((m) => m.includes('MAIL_TRANSPORT=log') && m.includes('123456') && m.includes('dev@test.local')));
  });

  it('log + real SMTP settings present: still not emailed', async () => {
    Object.assign(process.env, { MAIL_TRANSPORT: 'log', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u@example.com', SMTP_PASS: 'x' });
    await service.sendAuthCode('dev@test.local', '654321', 'reset');
    assert.ok(logs.some((m) => m.includes('654321')));
  });

  it('log in production: not configured and sending throws (defence in depth)', async () => {
    Object.assign(process.env, { MAIL_TRANSPORT: 'log', NODE_ENV: 'production' });
    assert.equal(service.isConfigured(), false);
    await assert.rejects(() => service.sendAuthCode('prod@test.local', '111111'), /not allowed in production/);
    assert.ok(!logs.some((m) => m.includes('111111')), 'production must not log the code');
  });

  it('smtp (default) without SMTP settings: not configured', () => {
    assert.equal(service.isConfigured(), false);
  });
});

describe('API startup with NODE_ENV=production and MAIL_TRANSPORT=log', { timeout: 60_000 }, () => {
  const SERVER_DIR = resolve(__dirname, '..');
  const DB_ERROR = /Unable to connect to the database|ECONNREFUSED/;

  function startApi(mailTransport: string, stopWhen?: RegExp): Promise<{ code: number | null; output: string; killed: boolean }> {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const key of Object.keys(env)) {
      if (/^(JWT_|DATABASE_|REDIS_|SMTP_|SMS_|TWILIO_|ADMIN_|MAIL_)/.test(key)) delete env[key];
    }
    Object.assign(env, {
      NODE_ENV: 'production',
      JWT_SECRET: randomBytes(32).toString('hex'),
      MAIL_TRANSPORT: mailTransport,
      DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none',
      REDIS_URL: '',
      SMTP_HOST: '',
      ADMIN_EMAIL: '',
      ADMIN_PASSWORD: '',
      PORT: '0',
      TSX_TSCONFIG_PATH: resolve(SERVER_DIR, 'tsconfig.json'),
    });
    return new Promise((done) => {
      const child = spawn(process.execPath, ['--import', 'tsx', resolve(SERVER_DIR, 'src/main.ts')], { cwd: SERVER_DIR, env });
      let output = '';
      let killed = false;
      const stop = () => {
        if (child.exitCode === null) {
          killed = true;
          child.kill('SIGKILL');
        }
      };
      const timer = setTimeout(stop, 30_000);
      const onData = (c: Buffer) => {
        output += c.toString();
        if (stopWhen?.test(output)) stop();
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
      child.on('close', (code) => {
        clearTimeout(timer);
        done({ code, output, killed });
      });
    });
  }

  it('exits with code 1 before connecting to the database', async () => {
    const run = await startApi('log');
    assert.equal(run.killed, false, run.output);
    assert.equal(run.code, 1, run.output);
    assert.match(run.output, /Startup aborted: MAIL_TRANSPORT=log is not allowed in production/);
    assert.doesNotMatch(run.output, DB_ERROR);
  });

  it('control: MAIL_TRANSPORT=smtp passes the check and reaches the database step', async () => {
    const run = await startApi('smtp', DB_ERROR);
    assert.doesNotMatch(run.output, /Startup aborted/, run.output);
    assert.match(run.output, DB_ERROR);
  });
});
