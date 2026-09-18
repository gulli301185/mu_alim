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

/** Default image paths served from backend `/uploads`. */
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

/** Maps DB key → source file in `client/public` for seeding. */
export const SITE_IMAGE_SEED_FILES: Record<SiteImageKey, string> = {
  [SITE_IMAGE_KEYS.logo]: 'logo-mualim.png',
  [SITE_IMAGE_KEYS.qaScene]: 'qa-scene-full.jpg',
  [SITE_IMAGE_KEYS.teacherBanner]: 'ustaz-banner.jpg',
  [SITE_IMAGE_KEYS.landingUstazBg]: 'ustaz-bg-alatoo.jpg',
  [SITE_IMAGE_KEYS.landingUstazTeaser]: 'ustaz-teaser.jpg',
  [SITE_IMAGE_KEYS.reviewSky]: 'sky-hero.jpg',
  [SITE_IMAGE_KEYS.reviewOyu]: 'oyu-hero.jpg',
  [SITE_IMAGE_KEYS.reviewFlowers]: 'review-flowers.jpg',
  [SITE_IMAGE_KEYS.decorUzorCorner]: 'uzor-corner.png',
  [SITE_IMAGE_KEYS.heroSky]: 'sky-hero.jpg',
  [SITE_IMAGE_KEYS.heroBanner]: 'tunduk-hero.jpg',
  [SITE_IMAGE_KEYS.teacherQuestionScene]: 'ustaz-suroo-scene.jpg',
};
