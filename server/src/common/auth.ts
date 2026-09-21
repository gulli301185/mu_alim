import {
  CanActivate,
  ExecutionContext,
  Injectable,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppError } from './app-error';

export type AuthUser = {
  id: string;
  role: 'user' | 'admin';
};

export type AuthedRequest = Request & { user?: AuthUser };

function extractToken(req: Request) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/** `requireAuth` — 401 without a valid Bearer token. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(protected readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractToken(req);
    if (!token) throw new AppError(401, 'Кирүү талап кылынат');

    try {
      req.user = this.jwt.verify<AuthUser>(token);
    } catch {
      throw new AppError(401, 'Жараксыз токен');
    }
    return true;
  }
}

/** `requireAdmin` — valid token and `role === 'admin'`. */
@Injectable()
export class AdminGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    super.canActivate(context);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.user?.role !== 'admin') throw new AppError(403, 'Админ укугу керек');
    return true;
  }
}

/** `optionalAuth` — attaches `req.user` when the token is valid, never rejects. */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractToken(req);
    if (token) {
      try {
        req.user = this.jwt.verify<AuthUser>(token);
      } catch {
        /* ignore invalid token for public endpoints */
      }
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});

export function assertUserRole(user: AuthUser | undefined): asserts user is AuthUser {
  if (user?.role !== 'user') throw new AppError(403, 'Колдонуучу аккаунту керек');
}
