/** Wait used after a 429 when the browser does not expose `Retry-After` (cross-origin, CORS). */
export const DEFAULT_RETRY_AFTER_SEC = 60;

/**
 * An HTTP error from the API, keeping what the UI needs to react to it: the status, the
 * server's `code` and other fields it sent (e.g. `total` / `done`), and `Retry-After` when
 * the browser exposes the header. Still an `Error`, so existing `catch` blocks keep working.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfterSec?: number;
  readonly details: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    options: { code?: string; retryAfterSec?: number; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options.code;
    this.retryAfterSec = options.retryAfterSec;
    this.details = options.details ?? {};
  }
}

/** Seconds to wait from a `Retry-After` value (delta-seconds or an HTTP date); `undefined` if absent or unreadable. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Math.max(1, Number(trimmed));
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return undefined;
  return Math.max(1, Math.ceil((at - now) / 1000));
}

type ErrorResponse = {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
};

/** Reads an error response once and turns it into an ApiError (the message falls back when the body has none). */
export async function parseApiErrorResponse(res: ErrorResponse, fallback: string): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  const data = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const details: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'error' && key !== 'code') details[key] = value;
  }
  return new ApiError(typeof data.error === 'string' && data.error ? data.error : fallback, res.status, {
    code: typeof data.code === 'string' ? data.code : undefined,
    retryAfterSec: parseRetryAfter(res.headers.get('Retry-After')),
    details,
  });
}
