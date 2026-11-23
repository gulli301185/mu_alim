import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppError } from './app-error';

/**
 * Rate-limits by the signed-in user, not by IP (QA H-2 phase 1.5): `CF-Connecting-IP` /
 * `X-Forwarded-For` can be forged when the API is reached directly, a user id cannot.
 * Must run after JwtAuthGuard (controller-level guards run before route-level ones), which
 * sets `req.user`; without a user the request is refused rather than keyed by IP.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const id: unknown = req.user?.id;
    if (typeof id !== 'string' || id.length === 0) throw new AppError(401, 'Кирүү талап кылынат');
    return `user:${id}`;
  }
}
