import { jsPDF } from 'jspdf';

import { assetUrl } from './asset-url';

export const SITE_LOGO_URL = assetUrl('/uploads/logo-mualim.png');

const TEMPLATE_URL = '/certificate-template.png?v=3';
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

function ensureCertificateFonts(): Promise<void> {
  if (fontsReady) return fontsReady;

  fontsReady = (async () => {
    await Promise.all(
      CERT_FONTS.map(async (font) => {
        const face = new FontFace(font.family, `url(${font.url})`, {
          weight: font.weight,
          style: 'normal',
        });
        const loaded = await face.load();
        document.fonts.add(loaded);
      }),
    );
  })();

  return fontsReady;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Сертификат шаблону жүктөлбөдү'));
    image.src = url;
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

export async function downloadCourseCertificate(data: CertificateData): Promise<void> {
  await ensureCertificateFonts();

  const template = await loadImage(TEMPLATE_URL);
  const canvas = document.createElement('canvas');
  canvas.width = template.naturalWidth;
  canvas.height = template.naturalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Сертификат түзүлгөн жок');

  ctx.drawImage(template, 0, 0);
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

  const jpeg = canvas.toDataURL('image/jpeg', 0.92);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.addImage(jpeg, 'JPEG', 0, 0, 297, 210);
  doc.save(`sertifikat-${data.certificateNumber}.pdf`);
}

export const CERTIFICATE_NAME_KEY = 'mualim-certificate-name';

export function loadCertificateName(): string {
  try {
    return localStorage.getItem(CERTIFICATE_NAME_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function saveCertificateName(name: string) {
  localStorage.setItem(CERTIFICATE_NAME_KEY, name.trim());
}
