import type { i18n as I18n } from "i18next";

/** Returns a translated array/object list from the locale files when the
 * current language has one (e.g. ru.json's "teacherData.education"), else the
 * original Kyrgyz data from data/*.ts. Lets long content lists stay in their
 * source files for Kyrgyz without being duplicated into kg.json. */
export function localizedList<T>(
  i18n: I18n,
  key: string,
  fallback: readonly T[],
  values?: Record<string, unknown>,
): readonly T[] {
  if (!i18n.exists(key, { fallbackLng: [] })) return fallback;
  const value = i18n.t(key, { ...values, returnObjects: true });
  return Array.isArray(value) ? (value as T[]) : fallback;
}
