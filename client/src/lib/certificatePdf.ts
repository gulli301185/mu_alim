import { jsPDF } from 'jspdf';
import { SITE, TEACHER } from '../data/landing';

export const SITE_LOGO_URL = '/logo-mualim.png';
const LOGO_ASPECT = 907 / 1024;

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

function formatDate(date: Date): string {
  return date.toLocaleDateString('ky-KG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });

    if (!dataUrl) return null;

    const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    return { dataUrl, format };
  } catch {
    return null;
  }
}

export async function downloadCourseCertificate(data: CertificateData): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const w = 297;
  const navy = [15, 32, 58] as const;
  const gold = [201, 162, 39] as const;
  const cream = [252, 248, 240] as const;

  doc.setFillColor(...navy);
  doc.rect(0, 0, w, 210, 'F');

  doc.setFillColor(...cream);
  doc.roundedRect(12, 12, w - 24, 186, 4, 4, 'F');

  doc.setDrawColor(...gold);
  doc.setLineWidth(1.2);
  doc.roundedRect(16, 16, w - 32, 178, 3, 3, 'S');

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.4);
  doc.roundedRect(20, 20, w - 40, 170, 2, 2, 'S');

  const logo = await loadImageDataUrl(SITE_LOGO_URL);
  let contentTop = 34;

  if (logo) {
    const logoHeight = 20;
    const logoWidth = logoHeight * LOGO_ASPECT;
    doc.addImage(logo.dataUrl, logo.format, (w - logoWidth) / 2, 26, logoWidth, logoHeight);
    contentTop = 52;
  }

  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(SITE.subtitle.toUpperCase(), w / 2, contentTop, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('СЕРТИФИКАТ', w / 2, contentTop + 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text('Бул документ төмөнкү студент курсту ийгиликтүү аяктаганын ырастайт', w / 2, contentTop + 24, {
    align: 'center',
  });

  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(data.studentName, w / 2, contentTop + 44, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 80);
  doc.text('«' + data.courseTitle + '» курсун', w / 2, contentTop + 58, { align: 'center' });
  doc.text(
    `${data.scorePercent.toFixed(0)}% орточо көрсөткүч менен ийгиликтүү аяктаган`,
    w / 2,
    contentTop + 66,
    { align: 'center' },
  );

  doc.setFontSize(12);
  doc.text(`Устат: ${TEACHER.name}`, w / 2, contentTop + 80, { align: 'center' });

  doc.setDrawColor(...gold);
  doc.setLineWidth(0.6);
  doc.line(90, contentTop + 94, w - 90, contentTop + 94);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Берилген күнү: ${formatDate(data.issuedAt)}`, 36, contentTop + 108);
  doc.text(`№ ${data.certificateNumber}`, w - 36, contentTop + 108, { align: 'right' });

  doc.setFontSize(9);
  doc.text(`${SITE.name} · ${SITE.email}`, w / 2, contentTop + 134, { align: 'center' });
  doc.text(SITE.address, w / 2, contentTop + 140, { align: 'center' });

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
