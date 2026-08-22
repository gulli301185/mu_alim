/** Frontend landing.ts — FREE_VIDEOS (бекер баяндар) */
export const FREE_VIDEOS_SEED = [
  {
    videoId: 'ZkpJ1ezB2TI',
    title: 'Тойдо музыка койсо туурабы?',
    duration: '45:20',
    url: 'https://www.youtube.com/watch?v=ZkpJ1ezB2TI',
    date: '2025-07-25',
  },
  {
    videoId: 'jWh55FxqLhQ',
    title: 'Батасыз баш кошуу туурабы?',
    duration: '18:30',
    url: 'https://www.youtube.com/watch?v=jWh55FxqLhQ',
    date: '2025-07-24',
  },
  {
    videoId: 'iBn8RH4GSko',
    title: 'Сулуулугуна караш керекпи?',
    duration: '22:15',
    url: 'https://www.youtube.com/watch?v=iBn8RH4GSko',
    date: '2025-07-23',
  },
  {
    videoId: '-x5ZVt-W1Yg',
    title: 'Эмне керек үйлөнүүгө?',
    duration: '15:40',
    url: 'https://www.youtube.com/watch?v=-x5ZVt-W1Yg',
    date: '2025-07-22',
  },
  {
    videoId: 'jWh55FxqLhQ',
    title: 'Намаздын мааниси',
    duration: '12:05',
    url: 'https://www.youtube.com/watch?v=jWh55FxqLhQ',
    date: '2025-07-21',
  },
] as const;

const YT_IDS = ['mtKKIbWbRWc', 'ZkpJ1ezB2TI', 'jWh55FxqLhQ', 'iBn8RH4GSko', '-x5ZVt-W1Yg'] as const;

function courseIntro(index: number, duration: string) {
  const vid = YT_IDS[index % YT_IDS.length];
  return {
    title: 'Киришүү сабак',
    duration,
    videoId: vid,
    url: `https://www.youtube.com/watch?v=${vid}`,
  };
}

export const PAID_COURSES_SEED = [
  { slug: 'family', title: 'Үй-бүлөлүк бакыт', price: 4500, lessons: 12, intro: courseIntro(0, '10:15') },
  { slug: 'tasawuf', title: 'Тасауф илими', price: 4000, lessons: 12, intro: courseIntro(1, '09:40') },
  { slug: 'fiqh', title: 'Фикх', price: 3800, lessons: 12, intro: courseIntro(2, '11:05') },
  { slug: 'aqida', title: 'Акыйда', price: 3500, lessons: 12, intro: courseIntro(3, '08:50') },
  { slug: 'basics', title: 'Ислам негиздери', price: 3200, lessons: 10, intro: courseIntro(0, '12:20') },
  { slug: 'quran', title: 'Куран окуу', price: 3600, lessons: 14, intro: courseIntro(1, '14:10') },
  { slug: 'sunnah', title: 'Сүннөт негиздери', price: 3400, lessons: 11, intro: courseIntro(2, '09:55') },
  { slug: 'dua', title: 'Дубалар', price: 2800, lessons: 8, intro: courseIntro(3, '07:30') },
  { slug: 'ramadan', title: 'Рамазан даярдыгы', price: 3000, lessons: 9, intro: courseIntro(0, '11:45') },
  { slug: 'kids', title: 'Балдар тарбиясы', price: 3300, lessons: 10, intro: courseIntro(1, '10:05') },
  { slug: 'akhlaq', title: 'Адеп-ахлак', price: 3100, lessons: 10, intro: courseIntro(2, '08:40') },
  { slug: 'zakat', title: 'Зекет жана садака', price: 2900, lessons: 8, intro: courseIntro(3, '09:15') },
] as const;

export function parseDurationToSeconds(duration: string): number | null {
  const parts = duration.split(':').map((p) => Number(p.trim()));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export const FREE_COURSE = {
  slug: 'free-bayanlar',
  title: 'Бекер баяндар',
  description: 'Муалим академиясынын бекер видео баяндары — YouTube шилтемелери аркылуу.',
} as const;

export const AKHLAQ_LESSONS = [
  { title: '1-сабак: Киришүү — адеп-ахлак илими', videoId: 'jWh55FxqLhQ', duration: '12:20' },
  { title: '2-сабак: Ата-энеге адеп', videoId: 'ZkpJ1ezB2TI', duration: '18:40' },
  { title: '3-сабак: Коңшуга мамиле', videoId: 'iBn8RH4GSko', duration: '15:10' },
  { title: '4-сабак: Тилди сактоо', videoId: '-x5ZVt-W1Yg', duration: '14:25' },
  { title: '5-сабак: Чынчылдык жана ишеним', videoId: 'mtKKIbWbRWc', duration: '16:05' },
  { title: '6-сабак: Жөнөкөйлүк', videoId: 'jWh55FxqLhQ', duration: '13:50' },
  { title: '7-сабак: Ызаа жана сый', videoId: 'ZkpJ1ezB2TI', duration: '17:15' },
  { title: '8-сабак: Ачууну башкаруу', videoId: 'iBn8RH4GSko', duration: '14:40' },
  { title: '9-сабак: Жакшы жүрүм-турум', videoId: '-x5ZVt-W1Yg', duration: '15:55' },
  { title: '10-сабак: Адепти күнүмдүк турмушта', videoId: 'mtKKIbWbRWc', duration: '19:10' },
] as const;

export const DEMO_PAID_LESSONS = [
  {
    slug: 'family',
    title: '1-сабак: Киришүү',
    description: 'Бirinchi sabak',
    youtubeUrl: 'https://www.youtube.com/watch?v=jJ1V_5E1Khk',
    youtubeVideoId: 'jJ1V_5E1Khk',
    lessonOrder: 1,
    durationSeconds: 615,
  },
  {
    slug: 'family',
    title: '2-сабак: Улантуу',
    description: 'Ekinchi sabak',
    youtubeUrl: 'https://youtu.be/BIVXaQC1Lck',
    youtubeVideoId: 'BIVXaQC1Lck',
    lessonOrder: 2,
    durationSeconds: 580,
  },
] as const;
