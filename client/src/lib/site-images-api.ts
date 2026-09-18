import { API_BASE } from './asset-url';

export const SITE_IMAGE_KEYS = {
  logo: 'logo',
  qaScene: 'qa.scene',
  teacherBanner: 'teacher.banner',
  landingUstazBg: 'landing.ustazBg',
  landingUstazTeaser: 'landing.ustazTeaser',
  reviewSky: 'review.sky',
  reviewOyu: 'review.oyu',
  reviewFlowers: 'review.flowers',
  decorUzorCorner: 'decor.uzorCorner',
  heroSky: 'hero.sky',
  heroBanner: 'hero.banner',
  teacherQuestionScene: 'teacher.questionScene',
} as const;

export type SiteImageKey = (typeof SITE_IMAGE_KEYS)[keyof typeof SITE_IMAGE_KEYS];

/** Ustaz / landing section images editable in admin. */
export const USTAZ_SITE_IMAGE_KEYS = [
  SITE_IMAGE_KEYS.landingUstazBg,
  SITE_IMAGE_KEYS.landingUstazTeaser,
  SITE_IMAGE_KEYS.teacherBanner,
  SITE_IMAGE_KEYS.teacherQuestionScene,
] as const satisfies readonly SiteImageKey[];

export const USTAZ_SITE_IMAGE_LABELS: Record<(typeof USTAZ_SITE_IMAGE_KEYS)[number], string> = {
  [SITE_IMAGE_KEYS.landingUstazBg]: 'Фон сүрөт (башкы бет — устаз блогу)',
  [SITE_IMAGE_KEYS.landingUstazTeaser]: 'Устаз портрет (башкы бет — оң жак)',
  [SITE_IMAGE_KEYS.teacherBanner]: 'Баннер (/ustaz барак)',
  [SITE_IMAGE_KEYS.teacherQuestionScene]: 'Суроо формасы сүрөт (башкы бет)',
};

export const DEFAULT_SITE_IMAGES: Record<SiteImageKey, string> = {
  [SITE_IMAGE_KEYS.logo]: '/uploads/logo-mualim.png',
  [SITE_IMAGE_KEYS.qaScene]: '/uploads/qa-scene-full.jpg',
  [SITE_IMAGE_KEYS.teacherBanner]: '/uploads/ustaz-banner.jpg',
  [SITE_IMAGE_KEYS.landingUstazBg]: '/uploads/ustaz-bg-alatoo.jpg',
  [SITE_IMAGE_KEYS.landingUstazTeaser]: '/uploads/ustaz-teaser.jpg',
  [SITE_IMAGE_KEYS.reviewSky]: '/uploads/sky-hero.jpg',
  [SITE_IMAGE_KEYS.reviewOyu]: '/uploads/oyu-hero.jpg',
  [SITE_IMAGE_KEYS.reviewFlowers]: '/uploads/review-flowers.jpg',
  [SITE_IMAGE_KEYS.decorUzorCorner]: '/uploads/uzor-corner.png',
  [SITE_IMAGE_KEYS.heroSky]: '/uploads/sky-hero.jpg',
  [SITE_IMAGE_KEYS.heroBanner]: '/uploads/tunduk-hero.jpg',
  [SITE_IMAGE_KEYS.teacherQuestionScene]: '/uploads/ustaz-suroo-scene.jpg',
};

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || fallback;
}

export async function fetchSiteImages(): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/site-images`);
  if (!res.ok) throw new Error(await readError(res, 'Сүрөттөр жүктөлгөн жок'));
  const data = (await res.json()) as { images: Record<string, string> };
  return { ...DEFAULT_SITE_IMAGES, ...data.images };
}

export async function updateSiteImages(
  token: string,
  images: Record<string, string>,
): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/api/admin/site-images`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ images }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Сүрөттөр сакталган жок'));
  const data = (await res.json()) as { images: Record<string, string> };
  return { ...DEFAULT_SITE_IMAGES, ...data.images };
}
