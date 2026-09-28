import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Rate-limits by the caller's real IP. The API sits behind Cloudflare, so the
 * true client address arrives in `CF-Connecting-IP`; without this every request
 * would look like it came from the same Cloudflare edge IP.
 */
@Injectable()
export class CfThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.length > 0) return cf;
    return req.ips?.[0] ?? req.ip ?? 'unknown';
  }
}
