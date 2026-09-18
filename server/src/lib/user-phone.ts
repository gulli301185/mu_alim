import { prisma } from './prisma.js';
import { normalizeKgPhone } from './phone.js';

export function kgPhoneDigitKeys(normalized: string): string[] {
  const local = normalized.replace(/^\+996/, '');
  return [`996${local}`, `995${local}`, `0${local}`, local];
}

export function phonesMatch(storedPhone: string | null | undefined, normalized: string) {
  if (!storedPhone?.trim()) return false;
  const storedNormalized = normalizeKgPhone(storedPhone);
  if (storedNormalized && storedNormalized === normalized) return true;
  const storedDigits = storedPhone.replace(/\D/g, '');
  const local = normalized.replace(/^\+996/, '');
  if (local && storedDigits.slice(-9) === local) return true;
  return kgPhoneDigitKeys(normalized).includes(storedDigits);
}

export async function findUserByKgPhone(normalizedPhone: string, excludeId?: string) {
  const keys = kgPhoneDigitKeys(normalizedPhone);
  const rows = excludeId
    ? await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM users
         WHERE regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = ANY($1::text[])
           AND id <> $2::uuid
         LIMIT 1`,
        keys,
        excludeId,
      )
    : await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM users
         WHERE regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = ANY($1::text[])
         LIMIT 1`,
        keys,
      );

  const id = rows[0]?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}
