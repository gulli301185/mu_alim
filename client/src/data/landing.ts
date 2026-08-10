export const SITE = {
  name: 'Ислам Булагы',
  tagline: 'Куран жана Сүннөт ордосу',
  subtitle: 'Nur Academy · Mualim Academy',
  instagram: 'https://www.instagram.com/mualim.academy/',
  youtubeFree: 'https://www.youtube.com/@Muhammadalim_Halil',
  phone: '+996 500 864 404',
  email: 'info@mualim.academy',
};

export const NAV = [
  { label: 'Башкы бет', href: '/' },
  { label: 'Устаз', href: '/ustaz' },
  { label: 'Баяндар', href: '/#videos' },
  { label: 'Курстар', href: '/#paid' },
  { label: '100 суроо-жооп', href: '/#faq' },
  { label: 'Намаз', href: '/#prayer' },
  { label: 'Байланыш', href: '/#contact' },
] as const;

export const STATS = [
  { value: '1200+', label: 'Баяндар' },
  { value: '350+', label: 'Видеолор' },
  { value: '85 000+', label: 'Көрүүчүлөр' },
  { value: '15+', label: 'Жылдык кызмат' },
] as const;

export const QUICK_ACCESS = [
  { label: 'Намаз убакыттары', href: '/#prayer', emoji: '🕌' },
  { label: 'Курстар', href: '/#paid', emoji: '📖' },
  { label: 'Дубалар', href: '/#ayah', emoji: '🤲' },
  { label: 'Акыркы баян', href: '/#videos', emoji: '▶️' },
  { label: '100 суроо-жооп', href: '/#faq', emoji: '💬' },
  { label: 'Устаз', href: '/ustaz', emoji: '👤' },
] as const;

export const FREE_VIDEOS = [
  { id: 'ZkpJ1ezB2TI', title: 'Тойдо музыка койсо туурабы?', date: '2026-05-12', thumbnail: 'https://img.youtube.com/vi/ZkpJ1ezB2TI/mqdefault.jpg', url: 'https://www.youtube.com/watch?v=ZkpJ1ezB2TI' },
  { id: 'jWh55FxqLhQ', title: 'Батасыз баш кошуу туурабы?', date: '2026-05-12', thumbnail: 'https://img.youtube.com/vi/jWh55FxqLhQ/mqdefault.jpg', url: 'https://www.youtube.com/watch?v=jWh55FxqLhQ' },
  { id: 'iBn8RH4GSko', title: 'Сулуулугуна караш керекпи?', date: '2026-05-04', thumbnail: 'https://img.youtube.com/vi/iBn8RH4GSko/mqdefault.jpg', url: 'https://www.youtube.com/watch?v=iBn8RH4GSko' },
  { id: '-x5ZVt-W1Yg', title: 'Эмне керек үйлөнүүгө?', date: '2026-04-30', thumbnail: 'https://img.youtube.com/vi/-x5ZVt-W1Yg/mqdefault.jpg', url: 'https://www.youtube.com/watch?v=-x5ZVt-W1Yg' },
] as const;

export const PAID_COURSES = [
  { title: 'Үй-бүлөлүк бакыт', price: '4 500 сом', lessons: 12, rating: 5.0 },
  { title: 'Тасауф илими', price: '4 000 сом', lessons: 12, rating: 4.9 },
  { title: 'Фикh', price: '3 800 сом', lessons: 12, rating: 4.9 },
  { title: 'Акыйда', price: '3 500 сом', lessons: 12, rating: 4.8 },
] as const;

export const PRAYER_TIMES = [
  { name: 'Багым', time: '04:32' },
  { name: 'Күн', time: '06:15' },
  { name: 'Бешим', time: '12:45', active: true },
  { name: 'Аср', time: '16:20' },
  { name: 'Шам', time: '19:05' },
  { name: 'Куптан', time: '20:45' },
] as const;

export const CITIES = ['Бишкек', 'Ош', 'Жалал-Абад', 'Каракол', 'Талас'] as const;

export const HADITH = {
  text: '«Амалдар тек ниеттерге карата болот. Ар бир киши не ниет кылса, ошонун эле акыбетин көрөт.»',
  source: 'Бухари, 1',
};

export const AYAH = {
  arabic: 'رَبِّ زِدْنِي عِلْمًا',
  translation: 'Эжеби, менин билимимди арттыр',
  source: 'Taha, 114',
};

export const EVENTS = [
  { date: '13', month: 'Июн', title: 'Семинар: Үй-бүлө баалуулуктары', location: 'Талас', time: '09:30' },
  { date: '22', month: 'Мар', title: 'Онлайн курс: Ислам негиздери', location: 'Онлайн', time: '18:00' },
  { date: '01', month: 'Апр', title: 'Рамазан даярдыгы', location: 'Бишкек', time: '10:00' },
] as const;

export const TEACHER = {
  name: 'Мухаммадалим Халил',
  shortName: 'Muhammadalim',
  institute: '«Хазрети Осмон» ислам институту',
  role: 'Mualim Academy устазы',
  quote: 'МАКСАТСЫЗ ӨМҮР – БАГЫТСЫЗ КЕМЕДЕЙ.',
  quoteSub: 'БАГЫТЫҢДЫ ТАП, АНАН ТОКТОБО.',
  bio: 'Кыргызстандагы белгилүү ислам уламы, «Хазрети Осмон» ислам институтунун устазы. Mualim Academy платформасында онлайн курстарды жана YouTube каналында бекер баяндарды жүргүзөт. Куран, Сүннөт, фикh, акыйда, тasауф жана үй-бүлөлүк бакыт темаларында сабак берет.',
  stats: [
    { value: '1200+', label: 'Баяндар' },
    { value: '15+', label: 'Жыл тажрыйба' },
    { value: '85 000+', label: 'Көрүүчүлөр' },
  ],
  topics: [
    { icon: 'book' as const, title: 'Куран жана Сүннөт', desc: 'Куран аяттарынын жана хадистердин негизинде ишенимдүү маалымат.' },
    { icon: 'book' as const, title: 'Фикh жана акыйда', desc: 'Ислам укугу жана негизги ишеним маселелери боюнча терең сабakтар.' },
    { icon: 'grad' as const, title: 'Тasauф илими', desc: 'Жүрөктү тazaloo жана Аллаhка жakын болуу жолдору.' },
    { icon: 'grad' as const, title: 'Үй-бүлөлүк бакыт', desc: 'Үй-бүлө, ата-ене жана балдар боюнча практикалык кеңештер.' },
  ],
};

export const SOCIAL = [
  { name: 'YouTube', color: '#FF0000', href: 'https://youtube.com/@Muhammadalim_Halil' },
  { name: 'Telegram', color: '#0088cc', href: 'https://t.me' },
  { name: 'Instagram', color: '#E4405F', href: 'https://instagram.com/mualim.academy' },
  { name: 'WhatsApp', color: '#25D366', href: 'https://wa.me' },
] as const;

export const FAQ = [
  { q: 'Бекер сабактар кайдан алынат?', a: 'YouTube канал @Muhammadalim_Halil.' },
  { q: 'Акылуу курстарга кантип кирүү?', a: 'Төлөгөндөн кийин жеке кабинетте бардык сабактар ачылат.' },
  { q: 'Сертификат кандай берилет?', a: 'Бардык сабактарды аяктап, тесттерден 80% топтогондон кийин PDF форматында.' },
] as const;
