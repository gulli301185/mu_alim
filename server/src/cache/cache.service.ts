import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis-backed JSON cache. Every operation degrades to a cache miss when Redis is
 * unset or unreachable, so the API keeps working straight from PostgreSQL.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger('Cache');
  private readonly redis: Redis | null;
  private readonly prefix = process.env.REDIS_PREFIX?.trim() || 'mualim:';
  private failing = false;

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      this.redis = null;
      this.logger.warn('REDIS_URL is not set — caching is disabled');
      return;
    }

    this.redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });
    this.redis.on('ready', () => {
      this.failing = false;
      this.logger.log('Redis connected');
    });
    this.redis.on('error', (err) => this.fail('connection', err));
  }

  get enabled() {
    return this.redis !== null;
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  private fail(action: string, err: unknown) {
    if (this.failing) return;
    this.failing = true;
    this.logger.warn(`Redis ${action} failed, falling back to the database: ${(err as Error)?.message ?? err}`);
  }

  private k(key: string) {
    return `${this.prefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(this.k(key));
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (err) {
      this.fail('get', err);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number) {
    if (!this.redis) return;
    try {
      await this.redis.set(this.k(key), JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.fail('set', err);
    }
  }

  /** Returns the cached value, or runs `loader` and caches its result (`null` results are not cached). */
  async wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await loader();
    if (fresh !== null && fresh !== undefined) await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  async del(...keys: string[]) {
    if (!this.redis || keys.length === 0) return;
    try {
      await this.redis.unlink(...keys.map((key) => this.k(key)));
    } catch (err) {
      this.fail('del', err);
    }
  }

  /** Drops every key that starts with one of the given prefixes (e.g. `courses:`). */
  async invalidate(...prefixes: string[]) {
    if (!this.redis) return;
    try {
      for (const prefix of prefixes) {
        let cursor = '0';
        do {
          const [next, keys] = await this.redis.scan(cursor, 'MATCH', `${this.k(prefix)}*`, 'COUNT', 200);
          cursor = next;
          if (keys.length > 0) await this.redis.unlink(...keys);
        } while (cursor !== '0');
      }
    } catch (err) {
      this.fail('invalidate', err);
    }
  }
}

@Global()
@Module({ providers: [CacheService], exports: [CacheService] })
export class CacheModule {}
