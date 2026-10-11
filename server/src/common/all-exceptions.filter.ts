import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { langFromRequest, translateErrorBody } from './i18n';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const lang = langFromRequest(http.getRequest<Request>());

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string' && !('statusCode' in body)) {
        res.status(status).json(translateErrorBody(body as Record<string, unknown>, lang));
        return;
      }
      const message =
        typeof body === 'object' && body !== null && 'message' in body
          ? [(body as { message: string | string[] }).message].flat().join(', ')
          : exception.message;
      res.status(status).json(translateErrorBody({ error: message }, lang));
      return;
    }

    // Malformed JSON / oversized body errors raised by the body parser.
    const status = (exception as { status?: number } | null)?.status;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json(translateErrorBody({ error: 'Маалымат туура эмес' }, lang));
      return;
    }

    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    res.status(500).json(translateErrorBody({ error: 'Сервер катасы' }, lang));
  }
}
