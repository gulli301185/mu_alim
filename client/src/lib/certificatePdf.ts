import { jsPDF } from 'jspdf';

import { assetUrl } from './asset-url';
import { chooseSaveStrategy, fitFontSize, isIosDevice } from './certificate-save';

export const SITE_LOGO_URL = assetUrl('/uploads/logo-mualim.png');

const TEMPLATE_URL = '/certificate-template.png?v=3';
/** Cap canvas size so phones don't OOM on the 3072×2172 template. */
const MAX_CANVAS_WIDTH = 1600;
const CERT_FONTS = [
  { family: 'CertSerif', url: '/fonts/NotoSerif-Regular.ttf', weight: '400' },
  { family: 'CertSerif', url: '/fonts/NotoSerif-Bold.ttf', weight: '700' },
  { family: 'CertSans', url: '/fonts/NotoSans-Regular.ttf', weight: '400' },
] as const;

let fontsReady: Promise<void> | null = null;

export type CertificateData = {
  studentName: string;
  courseTitle: string;
  scorePercent: number;
  issuedAt: Date;
  certificateNumber: string;
};

export function generateCertificateNumber(courseId: string): string {
  const year = new Date().getFullYear();
  const prefix = courseId.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'CRS';
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MA-${year}-${prefix}-${rand}`;
}

function formatDateNumeric(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

function absoluteAssetUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).href;
}

function ensureCertificateFonts(): Promise<void> {
  if (fontsReady) return fontsReady;

  fontsReady = (async () => {
    await Promise.all(
      CERT_FONTS.map(async (font) => {
        try {
          const face = new FontFace(font.family, `url(${absoluteAssetUrl(font.url)})`, {
            weight: font.weight,
            style: 'normal',
          });
          const loaded = await face.load();
          document.fonts.add(loaded);
        } catch {
          // System fonts still render the certificate if a face fails to load.
        }
      }),
    );
  })();

  return fontsReady;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Сертификат шаблону жүктөлбөдү'));
    image.src = absoluteAssetUrl(url);
  });
}

function wrapCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, startY + index * lineHeight);
  });
}

/** Result of a download: saved / shown in a tab for saving (iOS) / share sheet cancelled. */
export type CertificateSaveResult = 'ok' | 'opened' | 'cancelled';

/**
 * iOS only: opens the tab the PDF will be shown in. Must be called synchronously from the click
 * handler, before any `await` — Safari blocks `window.open` once the click's user activation
 * has been used up by the network request and the rendering. Elsewhere returns null.
 */
export function prepareCertificateWindow(message: string): Window | null {
  if (typeof window === 'undefined' || !isIosDevice(navigator)) return null;
  const opened = window.open('', '_blank');
  if (!opened) return null;
  try {
    opened.document.title = message;
    opened.document.body.style.cssText = 'font-family:-apple-system,sans-serif;padding:24px;color:#1a1a1a';
    opened.document.body.textContent = message;
  } catch {
    /* the tab still works without the message */
  }
  return opened;
}

async function savePdfBlob(
  blob: Blob,
  filename: string,
  targetWindow: Window | null,
): Promise<CertificateSaveResult> {
  if (chooseSaveStrategy(navigator) === 'ios') {
    const file = new File([blob], filename, { type: 'application/pdf' });
    // The share sheet needs a still-active user activation; after the async work it usually is
    // not, and a failed share would only waste the tab prepared for the PDF.
    if (
      navigator.userActivation?.isActive === true &&
      typeof navigator.share === 'function' &&
      navigator.canShare?.({ files: [file] })
    ) {
      try {
        await navigator.share({ files: [file], title: 'Сертификат', text: filename });
        if (targetWindow && !targetWindow.closed) targetWindow.close();
        return 'ok';
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          if (targetWindow && !targetWindow.closed) targetWindow.close();
          return 'cancelled';
        }
        // Fall through to the tab.
      }
    }

    const url = URL.createObjectURL(blob);
    if (targetWindow && !targetWindow.closed) {
      targetWindow.location.href = url;
    } else if (!window.open(url, '_blank')) {
      // No tab at all — last resort: show the PDF in this tab.
      window.location.assign(url);
    }
    // Long enough for Safari to load the PDF and for Share → Save to Files.
    window.setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
    return 'opened';
  }

  // Android Chrome and desktop: a plain file download (Android saves it to Downloads).
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
  return 'ok';
}

export async function downloadCourseCertificate(
  data: CertificateData,
  targetWindow: Window | null = null,
): Promise<CertificateSaveResult> {
  await ensureCertificateFonts();

  const template = await loadImage(TEMPLATE_URL);
  const fit = Math.min(1, MAX_CANVAS_WIDTH / template.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(template.naturalWidth * fit));
  canvas.height = Math.max(1, Math.round(template.naturalHeight * fit));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Сертификат түзүлгөн жок');

  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1a1a1a';

  const scale = canvas.width / 1024;
  const centerX = canvas.width / 2;

  // A long name is shrunk to fit the frame instead of running past it.
  const studentName = data.studentName.trim();
  const nameSize = fitFontSize(
    (size) => {
      ctx.font = `400 ${size}px CertSerif, serif`;
      return ctx.measureText(studentName).width;
    },
    Math.round(40 * scale),
    Math.round(22 * scale),
    760 * scale,
  );
  ctx.font = `400 ${nameSize}px CertSerif, serif`;
  ctx.fillText(studentName, centerX, 312 * scale);

  const courseTitle = data.courseTitle.trim();
  const body =
    `Кара-Балта шаарындагы «Хазрети Осмон» атындагы ислам институту тарабынан уюштурулган ` +
    `«${courseTitle}» аттуу онлайн курска катышып, толук бүтүргөндүгүн тастыктайт.`;

  ctx.font = `400 ${Math.round(18 * scale)}px CertSans, sans-serif`;
  wrapCenteredText(ctx, body, centerX, 408 * scale, 720 * scale, 34 * scale);

  ctx.font = `400 ${Math.round(15 * scale)}px CertSans, sans-serif`;
  ctx.fillText(formatDateNumeric(data.issuedAt), centerX, 536 * scale);

  const jpeg = canvas.toDataURL('image/jpeg', 0.88);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.addImage(jpeg, 'JPEG', 0, 0, 297, 210);

  const filename = `sertifikat-${data.certificateNumber}.pdf`;
  const blob = doc.output('blob');
  return savePdfBlob(blob, filename, targetWindow);
}

export const CERTIFICATE_NAME_KEY = 'mualim-certificate-name';

function certificateNameKey(userId: string) {
  return `${CERTIFICATE_NAME_KEY}:${userId}`;
}

export function loadCertificateName(userId?: string | null): string {
  if (!userId) return '';
  try {
    const scoped = localStorage.getItem(certificateNameKey(userId))?.trim();
    if (scoped) return scoped;
    // One-time: ignore shared global name so accounts do not reuse each other.
    localStorage.removeItem(CERTIFICATE_NAME_KEY);
    return '';
  } catch {
    return '';
  }
}

export function saveCertificateName(name: string, userId?: string | null) {
  if (!userId) return;
  localStorage.setItem(certificateNameKey(userId), name.trim());
}
