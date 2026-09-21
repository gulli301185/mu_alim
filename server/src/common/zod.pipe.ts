import { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';
import { formatZodError } from '../lib/auth-validation';
import { AppError } from './app-error';

type ZodPipeOptions = {
  /** Fixed error text returned on any validation failure. */
  message?: string;
  /** Respond with the first zod issue message instead of a fixed text. */
  firstIssue?: boolean;
  /** Respond with `{ error, fields }` (auth forms). */
  fields?: boolean;
};

/** Validates a body/query with a zod schema and returns the parsed (coerced) value. */
export class ZodPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(
    private readonly schema: S,
    private readonly options: ZodPipeOptions = {},
  ) {}

  transform(value: unknown): z.infer<S> {
    const parsed = this.schema.safeParse(value ?? {});
    if (parsed.success) return parsed.data;

    const fallback = this.options.message ?? 'Маалымат туура эмес';
    if (this.options.fields) {
      const { error, fields } = formatZodError(parsed.error);
      throw new AppError(400, error, { fields });
    }
    if (this.options.firstIssue) {
      throw new AppError(400, parsed.error.issues[0]?.message ?? fallback);
    }
    throw new AppError(400, fallback);
  }
}
