import { jsPDF } from 'jspdf';

import { assetUrl } from './asset-url';

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

function isIosLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
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

/** Mobile-friendly save: Share sheet → anchor download → open PDF tab (iOS). */
async function savePdfBlob(blob: Blob, filename: string): Promise<'ok' | 'cancelled'> {
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Сертификат',
        text: filename,
      });
      return 'ok';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'cancelled';
      // Fall through to download / open.
    }
  }

  const url = URL.createObjectURL(blob);

  if (isIosLike()) {
    const opened = window.open(url, '_blank');
    if (!opened) {
      // Popup blocked — last resort for iOS.
      window.location.assign(url);
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'ok';
  }

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
): Promise<'ok' | 'cancelled'> {
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

  ctx.font = `400 ${Math.round(40 * scale)}px CertSerif, serif`;
  ctx.fillText(data.studentName.trim(), centerX, 312 * scale);

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
  return savePdfBlob(blob, filename);
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
