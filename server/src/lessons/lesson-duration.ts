import { AppError } from '../common/app-error';

/** A lesson video is at most 6 hours long. */
export const MAX_LESSON_DURATION_SECONDS = 21_600;

export const DURATION_REQUIRED_MESSAGE = 'Сабакты жарыялоо үчүн видеонун узактыгын киргизиңиз';
export const DURATION_INVALID_MESSAGE = 'Узактыгы 1 секунддан 6 саатка чейинки бүтүн сан болушу керек';

/** Non-blocking notice for an older published lesson that still has no duration. */
export type LessonWarning = 'DURATION_MISSING';

export type PublishState = { isPublished: boolean; durationSeconds: number | null };
export type PublishChanges = { isPublished?: boolean; durationSeconds?: number | null };
export type PublishCheck = 'ok' | 'DURATION_MISSING' | 'DURATION_REQUIRED';

export function isValidDuration(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_LESSON_DURATION_SECONDS
  );
}

/**
 * Validates `durationSeconds` from a request body. `undefined` = not sent (left as it is);
 * `null` = clear the duration, accepted only where clearing is possible (update).
 */
export function parseDurationField(
  value: unknown,
  options: { allowNull: boolean },
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null && options.allowNull) return null;
  if (isValidDuration(value)) return value;
  throw new AppError(400, DURATION_INVALID_MESSAGE, { code: 'DURATION_INVALID' });
}

/**
 * Whether a lesson may end up published without a duration. `existing` is null for a new
 * lesson. Nothing is mutated. Older lessons that were published without a duration stay
 * editable (DURATION_MISSING) — the admin form re-sends `isPublished: true`, which is not a
 * new publication. Newly publishing without a duration, or clearing the duration of a
 * published lesson that had one, is refused (DURATION_REQUIRED).
 */
export function evaluatePublishState(
  existing: PublishState | null,
  changes: PublishChanges,
): PublishCheck {
  const nextPublished = changes.isPublished ?? existing?.isPublished ?? false;
  const nextDuration =
    changes.durationSeconds !== undefined ? changes.durationSeconds : (existing?.durationSeconds ?? null);
  if (!nextPublished || nextDuration != null) return 'ok';

  if (existing?.isPublished) {
    // It had a duration and this request clears it while the lesson stays published.
    if (existing.durationSeconds != null) return 'DURATION_REQUIRED';
    return 'DURATION_MISSING';
  }
  return 'DURATION_REQUIRED';
}

/** Throws 400 DURATION_REQUIRED or returns the warnings for the response. */
export function assertPublishable(
  existing: PublishState | null,
  changes: PublishChanges,
): LessonWarning[] {
  const check = evaluatePublishState(existing, changes);
  if (check === 'DURATION_REQUIRED') {
    throw new AppError(400, DURATION_REQUIRED_MESSAGE, { code: 'DURATION_REQUIRED' });
  }
  return check === 'DURATION_MISSING' ? ['DURATION_MISSING'] : [];
}
