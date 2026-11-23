/**
 * Certificate PDF: how to hand the file to the user, and where its download button goes.
 * Pure helpers (no jsPDF, no DOM writes) so they can be unit-tested.
 */

type NavigatorLike = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
};

/** iPhone / iPad (iPadOS reports itself as a Mac with a touch screen). */
export function isIosDevice(nav: NavigatorLike): boolean {
  return (
    /iPad|iPhone|iPod/i.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1)
  );
}

/**
 * iOS: Safari ignores `<a download>` for blobs, so the PDF is shown in a tab (or the share
 * sheet) and saved from there with Share → Save to Files.
 * Everything else (Android Chrome, desktop): a plain file download.
 */
export function chooseSaveStrategy(nav: NavigatorLike): 'ios' | 'download' {
  return isIosDevice(nav) ? 'ios' : 'download';
}

/**
 * The sidebar shows its own download button only when the main area cannot: the certificate
 * was issued, but the lessons are no longer all completed (e.g. a lesson was added later).
 * Otherwise the main area (test result / "course finished") holds the single button.
 */
export function showSidebarCertificateButton(state: {
  hasIssuedCertificate: boolean;
  allLessonsDone: boolean;
}): boolean {
  return state.hasIssuedCertificate && !state.allLessonsDone;
}

/** Largest font size (from `start` down to `min`) at which `text` fits into `maxWidth`. */
export function fitFontSize(
  measure: (fontSize: number) => number,
  start: number,
  min: number,
  maxWidth: number,
): number {
  let size = start;
  while (size > min && measure(size) > maxWidth) size -= 1;
  return Math.max(size, min);
}
