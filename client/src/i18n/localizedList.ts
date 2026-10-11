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

/** Russian (etc.) version of a piece of admin-editable text, looked up by the
 * exact original Kyrgyz text in a locale-file group (e.g. ru.json "heroText").
 * Falls back to the original when the current language has no entry -- so
 * if an admin edits the text, it shows as-is until the dictionary is updated. */
export function localizedText(i18n: I18n, group: string, text: string): string {
  if (!i18n.exists(group, { fallbackLng: [] })) return text;
  const table = i18n.t(group, { returnObjects: true }) as unknown;
  if (!table || typeof table !== "object") return text;
  const normalized = text.replace(/\s+/g, " ").trim();
  const match = (table as Record<string, unknown>)[normalized];
  return typeof match === "string" ? match : text;
}
