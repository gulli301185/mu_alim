/**
 * Auth-code attempts per account (QA F-6).
 *
 * Every code check reserves an attempt synchronously, before the database is asked, so parallel
 * requests cannot check more than MAX_WRONG_CODES codes per window. When the attempt that reaches
 * the limit is wrong, the account's live codes are revoked; until the window ends further checks
 * are refused. Callers answer with the usual "invalid code" either way, so nothing about the
 * account is revealed. A right code clears the count. Kept in memory: the API runs as a single
 * replica, and a restart only resets the counters — revoked codes stay revoked.
 */
export const MAX_WRONG_CODES = 5;
export const WRONG_CODE_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED = 10_000;

type Entry = { count: number; since: number };

export class CodeAttemptLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    readonly max = MAX_WRONG_CODES,
    private readonly windowMs = WRONG_CODE_WINDOW_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Reserves an attempt for `key`: its number (1..max), or 0 when the attempts are used up. */
  tryAcquire(key: string): number {
    const entry = this.live(key) ?? { count: 0, since: this.now() };
    if (entry.count >= this.max) return 0;
    entry.count += 1;
    this.entries.set(key, entry);
    this.prune();
    return entry.count;
  }

  /** True while the account has used up its attempts in the current window. */
  isLocked(key: string): boolean {
    const entry = this.live(key);
    return entry !== undefined && entry.count >= this.max;
  }

  reset(key: string) {
    this.entries.delete(key);
  }

  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry && this.now() - entry.since >= this.windowMs) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  /** Bounds memory: expired entries go first, then the oldest ones. */
  private prune() {
    if (this.entries.size <= MAX_TRACKED) return;
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.since >= this.windowMs) this.entries.delete(key);
    }
    for (const key of this.entries.keys()) {
      if (this.entries.size <= MAX_TRACKED) break;
      this.entries.delete(key);
    }
  }
}
