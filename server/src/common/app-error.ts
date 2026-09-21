import { HttpException } from '@nestjs/common';

/** HTTP error whose JSON body is `{ error, ...extra }` — the shape the client expects. */
export class AppError extends HttpException {
  constructor(status: number, error: string, extra: Record<string, unknown> = {}) {
    super({ error, ...extra }, status);
  }
}
