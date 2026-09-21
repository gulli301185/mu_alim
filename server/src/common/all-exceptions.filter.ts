import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string' && !('statusCode' in body)) {
        res.status(status).json(body);
        return;
      }
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? [(body as { message: string | string[] }).message].flat().join(', ')
          : exception.message;
      res.status(status).json({ error: message });
      return;
    }

    // Malformed JSON / oversized body errors raised by the body parser.
    const status = (exception as { status?: number } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({ error: 'Маалымат туура эмес' });
      return;
    }

    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    res.status(500).json({ error: 'Сервер катасы' });
  }
}
