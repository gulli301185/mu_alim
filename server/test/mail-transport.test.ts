/**
 * QA ENV-1: `MAIL_TRANSPORT=log` lets local development and QA run without sending real email.
 * It must never be possible in production, and — like every MailService log line — it never
 * writes an address, an OTP code, the SMTP password or the raw SMTP reply to the log.
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

  it('log (development, no SMTP): configured, not emailed, and neither the code nor the address is logged', async () => {
    process.env.MAIL_TRANSPORT = 'log';
    process.env.NODE_ENV = 'development';
    assert.equal(service.isConfigured(), true);
    await service.sendAuthCode('dev@test.local', '123456', 'register');
    assert.ok(logs.some((m) => m.includes('MAIL_TRANSPORT=log') && m.includes('register')), logs.join('\n'));
    assert.ok(!logs.some((m) => m.includes('123456') || m.includes('dev@test.local') || m.includes('@')), logs.join('\n'));
  });

  it('log + real SMTP settings present: still not emailed, nothing secret logged', async () => {
    Object.assign(process.env, { MAIL_TRANSPORT: 'log', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'u@example.com', SMTP_PASS: 'x-secret-x' });
    await service.sendAuthCode('dev@test.local', '654321', 'reset');
    assert.ok(logs.some((m) => m.includes('MAIL_TRANSPORT=log')));
    assert.ok(!logs.some((m) => /654321|dev@test\.local|u@example\.com|x-secret-x/.test(m)), logs.join('\n'));
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

describe('MailService logs (SMTP mocked): no addresses, codes, passwords or raw SMTP text', () => {
  const saved = { ...process.env };
  const RECIPIENT = 'student.name@test.local';
  const SENDER = 'sender.box@example.com';
  const PASSWORD = 'Sup3r-Secret-App-Pass';
  const CODE = '482913';
  let logs: string[];
  let sentMessages: Array<Record<string, unknown>>;
  let service: MailService;

  /** A MailService whose transporter is a mock: `behave` decides what sendMail does. */
  function makeService(behave: (msg: Record<string, unknown>) => Promise<unknown>) {
    const svc = new MailService();
    const svcAny = svc as any;
    svcAny.createTransport = () => ({
      sendMail: async (msg: Record<string, unknown>) => {
        sentMessages.push(msg);
        return behave(msg);
      },
    });
    svcAny.logger = {
      log: (m: string) => logs.push(m),
      warn: (m: string) => logs.push(m),
      debug: (m: string) => logs.push(m),
      error: (m: string) => logs.push(m),
    };
    return svc;
  }

  /** Nothing sensitive in any log line: no address (no "@" at all), code, password or SMTP prose. */
  function assertLogsClean(extra: RegExp[] = []) {
    const text = logs.join('\n');
    for (const forbidden of [RECIPIENT, SENDER, CODE, PASSWORD, 'Invalid login', 'Username and Password', 'gsmtp']) {
      assert.ok(!text.includes(forbidden), `log contains "${forbidden}":\n${text}`);
    }
    assert.ok(!text.includes('@'), `log contains an address-like "@":\n${text}`);
    for (const re of extra) assert.doesNotMatch(text, re);
  }

  /** The JSON object logged after `prefix`. */
  function loggedJson(prefix: string) {
    const line = logs.find((m) => m.includes(prefix));
    assert.ok(line, `no "${prefix}" line in:\n${logs.join('\n')}`);
    return JSON.parse(line.slice(line.indexOf('{')));
  }

  beforeEach(() => {
    logs = [];
    sentMessages = [];
    for (const k of Object.keys(process.env)) if (/^(SMTP_|MAIL_TRANSPORT|NODE_ENV)/.test(k)) delete process.env[k];
    Object.assign(process.env, {
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: SENDER,
      SMTP_PASS: PASSWORD,
      NODE_ENV: 'development', // the old "DEV code" debug line used to appear here
    });
  });

  afterEach(() => {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  });

  it('1/6/7 success: email still sent with the code; log keeps kind, counts, SMTP code and message id only', async () => {
    service = makeService(async () => ({
      messageId: '<5f1c2a9e-77aa-4c1b-9d10-3b2e8f0c1d22@example.com>',
      accepted: [RECIPIENT],
      rejected: [],
      pending: [],
      response: `250 2.0.0 OK 1760000000 x1-20020a17090 - gsmtp (${RECIPIENT})`,
    }));
    await service.sendAuthCode(RECIPIENT, CODE, 'reset'); // resolves: behaviour unchanged

    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].to, RECIPIENT, 'mail must still go to the recipient');
    assert.ok(String(sentMessages[0].text).includes(CODE), 'the email itself must still contain the code');

    assert.deepEqual(loggedJson('mail sent'), {
      kind: 'reset',
      accepted: 1,
      rejected: 0,
      smtpCode: 250,
      messageId: '5f1c2a9e-77aa-4c1b-9d10-3b2e8f0c1d22',
    });
    assertLogsClean();
  });

  it('1 success in production: same safe line, no code', async () => {
    process.env.NODE_ENV = 'production';
    service = makeService(async () => ({ messageId: '<abc@example.com>', accepted: [RECIPIENT], rejected: [], response: '250 OK' }));
    await service.sendAuthCode(RECIPIENT, CODE, 'register');
    assert.equal(loggedJson('mail sent').kind, 'register');
    assertLogsClean();
  });

  it('2 recipient rejected: throws SMTP_REJECTED without the address; log has counts only', async () => {
    service = makeService(async () => ({
      messageId: '<x@example.com>',
      accepted: [],
      rejected: [RECIPIENT],
      response: `550 5.1.1 <${RECIPIENT}>: Recipient address rejected`,
    }));
    await assert.rejects(
      () => service.sendAuthCode(RECIPIENT, CODE, 'register'),
      (err: Error) => {
        assert.match(err.message, /^SMTP_REJECTED 1 recipient\(s\)$/);
        assert.ok(!err.message.includes('@'), 'error names the address');
        return true;
      },
    );
    assert.deepEqual(loggedJson('mail rejected'), { kind: 'register', accepted: 0, rejected: 1, smtpCode: 550 });
    assert.ok(!logs.some((m) => m.includes('mail sent')));
    assertLogsClean();
  });

  it('3/6 EAUTH 535: the same error object is re-thrown; log has stage/code/command/responseCode only', async () => {
    const authError = Object.assign(
      new Error(`Invalid login: 535-5.7.8 Username and Password not accepted for ${SENDER} (${PASSWORD})`),
      { code: 'EAUTH', command: 'AUTH PLAIN', responseCode: 535, response: `535-5.7.8 Username and Password not accepted ${SENDER}` },
    );
    service = makeService(async () => {
      throw authError;
    });
    await assert.rejects(() => service.sendAuthCode(RECIPIENT, CODE, 'reset'), (err) => err === authError);
    assert.deepEqual(loggedJson('mail failed'), {
      kind: 'reset',
      stage: 'auth',
      code: 'EAUTH',
      command: 'AUTH PLAIN',
      responseCode: 535,
    });
    assertLogsClean([/535-5\.7\.8/]);
  });

  it('4 connection timeout: stage connect, no error text in the log, error re-thrown', async () => {
    const timeout = Object.assign(new Error(`Connection timeout to smtp.example.com:587 while sending to ${RECIPIENT}`), {
      code: 'ETIMEDOUT',
      command: 'CONN',
    });
    service = makeService(async () => {
      throw timeout;
    });
    await assert.rejects(() => service.sendAuthCode(RECIPIENT, CODE, 'register'), (err) => err === timeout);
    assert.deepEqual(loggedJson('mail failed'), { kind: 'register', stage: 'connect', code: 'ETIMEDOUT', command: 'CONN' });
    assertLogsClean([/Connection timeout/, /smtp\.example\.com/]);
  });

  it('4 connection refused / socket error without a command: stage connect', async () => {
    service = makeService(async () => {
      throw Object.assign(new Error(`connect ECONNREFUSED 10.0.0.1:587 (${RECIPIENT})`), { code: 'ECONNECTION' });
    });
    await assert.rejects(() => service.sendAuthCode(RECIPIENT, CODE, 'reset'));
    assert.deepEqual(loggedJson('mail failed'), { kind: 'reset', stage: 'connect', code: 'ECONNECTION' });
    assertLogsClean([/10\.0\.0\.1/]);
  });

  it('6 unexpected fields are not trusted: odd code/command values containing data are dropped', async () => {
    service = makeService(async () => {
      throw Object.assign(new Error('boom'), {
        code: `EAUTH ${RECIPIENT}`,
        command: `RCPT TO:<${RECIPIENT}>`,
        responseCode: '550',
        response: `550 ${RECIPIENT}`,
      });
    });
    await assert.rejects(() => service.sendAuthCode(RECIPIENT, CODE, 'reset'));
    assert.deepEqual(loggedJson('mail failed'), { kind: 'reset', stage: 'send' });
    assertLogsClean();
  });

  it('7 not configured: still throws SMTP_NOT_CONFIGURED and never touches the transport', async () => {
    delete process.env.SMTP_HOST;
    service = makeService(async () => {
      throw new Error('transport must not be used');
    });
    await assert.rejects(() => service.sendAuthCode(RECIPIENT, CODE, 'reset'), /SMTP_NOT_CONFIGURED/);
    assert.equal(sentMessages.length, 0);
    assertLogsClean();
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
