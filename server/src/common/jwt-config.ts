import { Logger } from '@nestjs/common';
import type { JwtModuleOptions } from '@nestjs/jwt';

/** Unchanged from before, so tokens that are already issued stay valid. */
export const JWT_ALGORITHM = 'HS256' as const;
export const JWT_EXPIRES_IN = '7d';

export const MIN_JWT_SECRET_LENGTH = 32;
const MIN_DISTINCT_CHARS = 10;

/** Local development only — refused when NODE_ENV=production. */
export const DEV_FALLBACK_JWT_SECRET = 'dev-secret-change-me';

/** Placeholders and defaults that must never sign production tokens (compared case-insensitively). */
const KNOWN_WEAK_SECRETS = new Set([
  DEV_FALLBACK_JWT_SECRET,
  'change-this-secret-in-production',
  'change-me',
  'changeme',
  'secret',
  'jwt-secret',
  'jwt_secret',
  'your-secret',
  'your_jwt_secret',
]);

type Warn = (message: string) => void;

const logger = new Logger('JWT');
const defaultWarn: Warn = (message) => logger.warn(message);

/** Why `secret` is unsafe, or null. Messages never include the secret itself. */
function weakness(secret: string): string | null {
  if (!secret.trim()) return 'JWT_SECRET is not set';
  if (KNOWN_WEAK_SECRETS.has(secret.trim().toLowerCase())) {
    return 'JWT_SECRET is a known default/placeholder value';
  }
  if (secret !== secret.trim()) return 'JWT_SECRET has leading or trailing whitespace';
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    return `JWT_SECRET is too short (minimum ${MIN_JWT_SECRET_LENGTH} characters)`;
  }
  if (new Set(secret).size < MIN_DISTINCT_CHARS) return 'JWT_SECRET has too few distinct characters';
  return null;
}

/**
 * The JWT signing secret. With NODE_ENV=production a missing or weak secret throws
 * (the API must not start); elsewhere it only warns and, if unset, falls back to the
 * local development secret.
 */
export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env, warn: Warn = defaultWarn): string {
  const secret = env.JWT_SECRET ?? '';
  const problem = weakness(secret);
  if (!problem) return secret;

  if (env.NODE_ENV === 'production') {
    throw new Error(`${problem}. Generate one with: openssl rand -hex 32`);
  }
  if (!secret.trim()) {
    warn(`${problem} — using the local development fallback. Never run production like this.`);
    return DEV_FALLBACK_JWT_SECRET;
  }
  warn(`${problem} — allowed outside production only.`);
  return secret;
}

export function jwtModuleOptions(env: NodeJS.ProcessEnv = process.env, warn?: Warn): JwtModuleOptions {
  return {
    secret: resolveJwtSecret(env, warn),
    signOptions: { algorithm: JWT_ALGORITHM, expiresIn: JWT_EXPIRES_IN },
    verifyOptions: { algorithms: [JWT_ALGORITHM] },
  };
}
