/**
 * QA F9 startup check: with NODE_ENV=production the API must refuse to start on a
 * missing/weak JWT_SECRET *before* it touches the database, and never print the secret.
 *
 * Starts server/src/main.ts in a child process (tsx) against an unreachable database
 * (127.0.0.1:1), so no real database is ever contacted.
 *
 * Run:
 *   TSX_TSCONFIG_PATH=server/tsconfig.json node --import tsx --test server/test/jwt-startup.test.ts
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const SERVER_DIR = resolve(__dirname, '..');
const MAIN = resolve(SERVER_DIR, 'src/main.ts');
const UNREACHABLE_DB = 'postgres://nobody@127.0.0.1:1/none';
const DB_ERROR = /Unable to connect to the database|ECONNREFUSED/;

type Run = { code: number | null; output: string; killed: boolean };

/** Starts the API; resolves on exit, or kills it once `stopWhen` matches / after `timeoutMs`. */
function startApi(jwtSecret: string, opts: { stopWhen?: RegExp; timeoutMs?: number } = {}): Promise<Run> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(JWT_|DATABASE_|REDIS_|SMTP_|SMS_|TWILIO_|ADMIN_)/.test(key)) delete env[key];
  }
  Object.assign(env, {
    NODE_ENV: 'production',
    // Set explicitly (even when empty) so the repo-root .env cannot fill them in: dotenv never overrides.
    JWT_SECRET: jwtSecret,
    DATABASE_URL: UNREACHABLE_DB,
    REDIS_URL: '',
    ADMIN_EMAIL: '',
    ADMIN_PASSWORD: '',
    SMTP_HOST: '',
    PORT: '0',
    TSX_TSCONFIG_PATH: resolve(SERVER_DIR, 'tsconfig.json'),
  });

  return new Promise((done) => {
    const child = spawn(process.execPath, ['--import', 'tsx', MAIN], { cwd: SERVER_DIR, env });
    let output = '';
    let killed = false;
    const stop = () => {
      if (child.exitCode === null) {
        killed = true;
        child.kill('SIGKILL');
      }
    };
    const timer = setTimeout(stop, opts.timeoutMs ?? 30_000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (opts.stopWhen?.test(output)) stop();
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code) => {
      clearTimeout(timer);
      done({ code, output, killed });
    });
  });
}

function assertAbortedBeforeDb(run: Run, secret: string, reason: RegExp) {
  assert.equal(run.killed, false, `server did not stop by itself:\n${run.output}`);
  assert.equal(run.code, 1, `expected exit code 1, got ${run.code}:\n${run.output}`);
  assert.match(run.output, /Startup aborted/);
  assert.match(run.output, reason);
  assert.doesNotMatch(run.output, DB_ERROR, 'it tried to reach the database first');
  if (secret.trim()) assert.ok(!run.output.includes(secret.trim()), 'output contains the secret');
}

describe('API startup with NODE_ENV=production', { timeout: 120_000 }, () => {
  it('empty JWT_SECRET → exits with code 1 before connecting to the database', async () => {
    assertAbortedBeforeDb(await startApi(''), '', /JWT_SECRET is not set/);
  });

  it('the old built-in fallback secret → exits before the database, without printing it', async () => {
    assertAbortedBeforeDb(await startApi('dev-secret-change-me'), 'dev-secret-change-me', /known/);
  });

  it('the .env.example placeholder → exits before the database, without printing it', async () => {
    const placeholder = 'change-this-secret-in-production';
    assertAbortedBeforeDb(await startApi(placeholder), placeholder, /known/);
  });

  it('a short random secret → exits before the database, without printing it', async () => {
    const short = randomBytes(10).toString('hex');
    assertAbortedBeforeDb(await startApi(short), short, /too short/);
  });

  it('control: a strong secret passes the check and the server goes on to the database step', async () => {
    const secret = randomBytes(32).toString('hex');
    const run = await startApi(secret, { stopWhen: DB_ERROR });
    assert.doesNotMatch(run.output, /Startup aborted|JWT_SECRET/, run.output);
    assert.match(run.output, DB_ERROR, `never reached the database step:\n${run.output}`);
    assert.ok(!run.output.includes(secret), 'output contains the secret');
  });
});
