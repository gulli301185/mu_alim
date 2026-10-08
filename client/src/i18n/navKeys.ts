/** Maps a nav item's exact Kyrgyz label text to its translation key, so
 * Header/Footer can render the shared NAV_PRIMARY/NAV_MENU/FOOTER_COLUMNS
 * data (plain Kyrgyz strings in data/landing.ts) through i18next without
 * restructuring that data. Keyed by label text rather than href, since
 * some hrefs (e.g. "/#contact") are reused by more than one label. */
export const NAV_LABEL_KEY_BY_TEXT: Record<string, string> = {
  "Башкы бет": "nav.home",
  Устаз: "nav.teacher",
  Курстар: "nav.courses",
  "Суроо-жооп": "nav.questions",
  Байланыш: "nav.contact",
  Баяндар: "nav.videos",
  Катталуу: "nav.register",
  Бөлүмдөр: "nav.sections",
  Маалымат: "nav.info",
  // QUICK_ACCESS reuses some of the labels above plus these extra ones.
  Пикирлер: "quick.Пикирлер",
  Дубалар: "quick.Дубалар",
  "Акыркы баян": "quick.Акыркы баян",
};

/** Looks up an EVENTS item's title/location, or a short month abbreviation,
 * by its exact Kyrgyz text. Falls back to the text itself (unmapped
 * strings render as their original Kyrgyz). */
export function eventTextKey(text: string): string {
  return `events.${text}`;
}

export function monthAbbrKey(text: string): string {
  return `months.${text}`;
}

export function navLabelKey(label: string): string {
  return NAV_LABEL_KEY_BY_TEXT[label] ?? label;
}
