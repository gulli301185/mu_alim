import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { User } from '../database/entities';
import { AppError } from './app-error';
import { UUID_RE } from './uuid';

export type AuthUser = {
  id: string;
  role: 'user' | 'admin';
};

export type AuthedRequest = Request & { user?: AuthUser };

export const SESSION_INVALID_MESSAGE = 'Сессия жараксыз. Кайра кириңиз.';
export const ACCOUNT_DISABLED_MESSAGE = 'Аккаунт бөгөттөлгөн';

const logger = new Logger('Auth');

function extractToken(req: Request) {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

/** A verified session, or the error the request must be refused with. */
type Session = { ok: true; user: AuthUser } | { ok: false; error: AppError };

const sessionInvalid = () => new AppError(401, SESSION_INVALID_MESSAGE, { code: 'SESSION_INVALID' });

/**
 * Checks the token's signature and expiry, then loads the CURRENT account (id, role, isActive)
 * from the database (QA P0): a deleted, blocked or demoted account is refused even while its old
 * token is still valid, and `req.user` carries the role from the database, not from the token.
 * A database failure is never treated as "no account": it throws a 503 without internal details.
 */
async function resolveSession(
  jwt: JwtService,
  users: Repository<User>,
  token: string,
): Promise<Session> {
  let payload: Partial<AuthUser>;
  try {
    payload = jwt.verify<AuthUser>(token);
  } catch {
    return { ok: false, error: new AppError(401, 'Жараксыз токен') };
  }
  if (typeof payload.id !== 'string' || !UUID_RE.test(payload.id) || (payload.role !== 'user' && payload.role !== 'admin')) {
    return { ok: false, error: sessionInvalid() };
  }

  let account: Pick<User, 'id' | 'role' | 'isActive'> | null;
  try {
    account = await users.findOne({
      where: { id: payload.id },
      select: { id: true, role: true, isActive: true },
    });
  } catch (err) {
    // Only the error class is logged: no query, user id or connection details.
    logger.error(`account lookup failed (${err instanceof Error ? err.name : typeof err})`);
    throw new AppError(503, 'Сервер катасы', { code: 'AUTH_UNAVAILABLE' });
  }

  if (!account || account.role !== payload.role) return { ok: false, error: sessionInvalid() };
  if (!account.isActive) {
    return { ok: false, error: new AppError(403, ACCOUNT_DISABLED_MESSAGE, { code: 'ACCOUNT_DISABLED' }) };
  }
  return { ok: true, user: { id: account.id, role: account.role } };
}

/** `requireAuth` — 401 without a valid Bearer token or a current account, 403 if it is blocked.
 * Both dependencies are injected by explicit token: with `@InjectRepository` on the second one,
 * a runtime without decorator metadata (tsx / esbuild, used by the startup tests) would leave
 * the first one unresolved. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) protected readonly jwt: JwtService,
    @InjectRepository(User) protected readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractToken(req);
    if (!token) throw new AppError(401, 'Кирүү талап кылынат');

    const session = await resolveSession(this.jwt, this.users, token);
    if (!session.ok) throw session.error;
    req.user = session.user;
    return true;
  }
}

/** `requireAdmin` — a current, active account whose role in the database is `admin`. */
@Injectable()
export class AdminGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.user?.role !== 'admin') throw new AppError(403, 'Админ укугу керек');
    return true;
  }
}

/**
 * `optionalAuth` — attaches `req.user` for a current, active account; a missing, invalid,
 * deleted, blocked or demoted session is treated as anonymous. A database failure is NOT
 * (fail closed): the request is refused with the same 503 as on protected routes.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractToken(req);
    if (token) {
      const session = await resolveSession(this.jwt, this.users, token);
      if (session.ok) req.user = session.user;
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
