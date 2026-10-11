/**
 * QA F9: the JWT signing secret must be strong in production, and tokens must be
 * HS256 only (with the existing 7-day lifetime, so live tokens stay valid).
 *
 * Run (no extra packages — Node's built-in runner + the repo's existing tsx):
 *   TSX_TSCONFIG_PATH=server/tsconfig.json node --import tsx --test server/test/jwt-config.test.ts
 *
 * Secrets here are generated per run; assertions only check that they never appear in messages.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { JwtService } from '@nestjs/jwt';
import {
  DEV_FALLBACK_JWT_SECRET,
  JWT_ALGORITHM,
  JWT_EXPIRES_IN,
  MIN_JWT_SECRET_LENGTH,
  jwtModuleOptions,
  resolveJwtSecret,
} from '../src/common/jwt-config';

const strongHex = () => randomBytes(32).toString('hex'); // 64 chars
const strongB64 = () => randomBytes(32).toString('base64url'); // 43 chars

function rejects(env: NodeJS.ProcessEnv, pattern: RegExp, label: string) {
  const warnings: string[] = [];
  assert.throws(
    () => resolveJwtSecret(env, (m) => warnings.push(m)),
    (err: unknown) => {
      assert.ok(err instanceof Error, `${label}: not an Error`);
      assert.match(err.message, pattern, `${label}: unexpected message "${err.message}"`);
      const secret = env.JWT_SECRET?.trim();
      if (secret) {
        assert.ok(!err.message.includes(secret), `${label}: error message contains the secret`);
        assert.ok(!(err.stack ?? '').includes(secret), `${label}: stack contains the secret`);
      }
      return true;
    },
    label,
  );
  assert.deepEqual(warnings, [], `${label}: production must fail, not warn`);
}

describe('resolveJwtSecret() — NODE_ENV=production is strict', () => {
  const prod = (JWT_SECRET?: string): NodeJS.ProcessEnv =>
    JWT_SECRET === undefined ? { NODE_ENV: 'production' } : { NODE_ENV: 'production', JWT_SECRET };

  it('missing secret → error', () => rejects(prod(), /JWT_SECRET is not set/, 'missing'));
  it('empty secret → error', () => rejects(prod(''), /JWT_SECRET is not set/, 'empty'));
  it('blank secret → error', () => rejects(prod('   '), /JWT_SECRET is not set/, 'blank'));
  it(`shorter than ${MIN_JWT_SECRET_LENGTH} chars → error`, () =>
    rejects(prod(strongHex().slice(0, 20)), /too short/, 'short'));
  it('exactly one char short → error', () =>
    rejects(prod(strongHex().slice(0, MIN_JWT_SECRET_LENGTH - 1)), /too short/, 'length-1'));
  it('the old built-in fallback → error', () => rejects(prod('dev-secret-change-me'), /known/, 'fallback'));
  it('the .env.example placeholder → error', () =>
    rejects(prod('change-this-secret-in-production'), /known/, '.env.example'));
  it('known weak value in another case → error', () => rejects(prod('CHANGE-ME'), /JWT_SECRET/, 'CHANGE-ME'));
  it('known weak value in mixed case → rejected as known', () =>
    rejects(prod('Dev-Secret-Change-Me'), /known/, 'mixed case fallback'));
  it('long but low-variety secret (40 × "a") → error', () =>
    rejects(prod('a'.repeat(40)), /too few distinct/, 'aaaa'));
  it('leading/trailing whitespace → error', () =>
    rejects(prod(` ${strongHex()} `), /whitespace/, 'whitespace'));

  it('64 random hex chars → accepted as is', () => {
    const secret = strongHex();
    const warnings: string[] = [];
    assert.equal(resolveJwtSecret(prod(secret), (m) => warnings.push(m)), secret);
    assert.deepEqual(warnings, []);
  });

  it('43-char base64url secret (32 random bytes) → accepted', () => {
    const secret = strongB64();
    assert.equal(resolveJwtSecret(prod(secret), () => undefined), secret);
  });

  it(`exactly ${MIN_JWT_SECRET_LENGTH} chars → accepted`, () => {
    const secret = strongHex().slice(0, MIN_JWT_SECRET_LENGTH);
    assert.equal(resolveJwtSecret(prod(secret), () => undefined), secret);
  });
});

describe('resolveJwtSecret() — outside production only warns', () => {
  it('no NODE_ENV, no secret → dev fallback + one warning without any secret', () => {
    const warnings: string[] = [];
    assert.equal(resolveJwtSecret({}, (m) => warnings.push(m)), DEV_FALLBACK_JWT_SECRET);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /JWT_SECRET is not set/);
    assert.ok(!warnings[0].includes(DEV_FALLBACK_JWT_SECRET), 'warning prints the fallback value');
  });

  it('NODE_ENV=development, weak secret → used, with a warning that does not contain it', () => {
    const warnings: string[] = [];
    const weak = 'weak-dev-value';
    assert.equal(resolveJwtSecret({ NODE_ENV: 'development', JWT_SECRET: weak }, (m) => warnings.push(m)), weak);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /too short/);
    assert.ok(!warnings[0].includes(weak), 'warning prints the secret');
  });

  it('NODE_ENV=test with a strong secret (E2E harness setup) → used, no warning', () => {
    const secret = strongB64();
    const warnings: string[] = [];
    assert.equal(resolveJwtSecret({ NODE_ENV: 'test', JWT_SECRET: secret }, (m) => warnings.push(m)), secret);
    assert.deepEqual(warnings, []);
  });
});

describe('jwtModuleOptions() — HS256 only, 7 days', () => {
  const secret = strongHex();
  const env: NodeJS.ProcessEnv = { NODE_ENV: 'production', JWT_SECRET: secret };
  const jwt = new JwtService(jwtModuleOptions(env, () => undefined));
  const payload = { id: '11111111-1111-4111-8111-111111111111', role: 'user' as const };

  const header = (token: string) => JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());

  it('signs with HS256 and a 7-day lifetime', () => {
    assert.equal(JWT_ALGORITHM, 'HS256');
    assert.equal(JWT_EXPIRES_IN, '7d');
    const token = jwt.sign(payload);
    assert.equal(header(token).alg, 'HS256');
    const decoded = jwt.verify<{ iat: number; exp: number; id: string }>(token);
    assert.equal(decoded.id, payload.id);
    assert.equal(decoded.exp - decoded.iat, 7 * 24 * 60 * 60);
  });

  it('accepts a token issued by the previous config (default alg, 7d) — live sessions survive', () => {
    const previous = new JwtService({ secret, signOptions: { expiresIn: '7d' } });
    const legacyToken = previous.sign(payload);
    assert.equal(header(legacyToken).alg, 'HS256');
    assert.equal(jwt.verify<{ id: string }>(legacyToken).id, payload.id);
  });

  it('rejects the same secret with HS512', () => {
    const hs512 = new JwtService({ secret }).sign(payload, { algorithm: 'HS512' });
    assert.throws(() => jwt.verify(hs512), /invalid algorithm/);
  });

  it('rejects an unsigned alg=none token', () => {
    const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...payload, role: 'admin', iat: now, exp: now + 60 })}.`;
    assert.throws(() => jwt.verify(unsigned));
  });

  it('rejects a token signed with another secret', () => {
    const other = new JwtService({ secret: strongHex() }).sign(payload);
    assert.throws(() => jwt.verify(other), /invalid signature/);
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(payload, { expiresIn: -10 });
    assert.throws(() => jwt.verify(expired), /expired/);
  });

  it('refuses to build options in production with a weak secret', () => {
    assert.throws(() => jwtModuleOptions({ NODE_ENV: 'production', JWT_SECRET: 'dev-secret-change-me' }, () => undefined));
  });
});
