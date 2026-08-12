export const SITE = {
  name: "Ислам Булагы",
  tagline: "Куран жана Сүннөт ордосу",
  subtitle: "Nur Academy · Mualim Academy",
  instagram: "https://www.instagram.com/mualim.academy/",
  youtubeFree: "https://www.youtube.com/@Muhammadalim_Halil",
  phone: "+996 500 864 404",
  email: "info@mualim.academy",
  address: "Бишкек ш., Кыргызстан",
};

export const PAYMENT_TERMS = [
  "Төлөм ырасталганда курс материалдарына жеке кабинет аркылуу кирүү берилет.",
  "Кирүү мөөнөтү төлөмдөн кийин 24 саат ичинде активдештирилет.",
  "Курс материалдарын үчүнчү жактарга берүү, көчүрүү же таратууга тыюу салынат.",
  "Төлөм кайтарылбайт, эгер курс материалына кирүү ачылган болсо.",
  "Техникалык көйгөйлөр үчүн колдоо: " + SITE.phone,
  "Mualim Academy платформасынын жалпы колдонуу шарттары колдонулат.",
] as const;

export const FOOTER_COLUMNS = [
  {
    title: "Бөлмөлөр",
    links: [
      { label: "Башкы бет", href: "/" },
      { label: "Устаз", href: "/ustaz" },
      { label: "Баяндар", href: "/#videos" },
      { label: "Курстар", href: "/courses" },
    ],
  },
  {
    title: "Маалымат",
    links: [
      { label: "Намаз убакыттары", href: "/#prayer" },
      { label: "Cуроо-жооп", href: "/questions" },
      { label: "Биздин сабактар", href: "/#videos" },
      { label: "Байланыш", href: "/#contact" },
    ],
  },
  {
    title: "Колдоо",
    links: [
      { label: "Жардам & FAQ", href: "/questions" },
      { label: "Шарттар", href: "/#contact" },
      { label: "Баалар", href: "/courses" },
      { label: "Катталуу", href: "/#contact" },
    ],
  },
] as const;

export const FOOTER_SOCIAL = [
  { name: "Telegram", color: "#0088cc", href: "https://t.me" },
  { name: "WhatsApp", color: "#25D366", href: "https://wa.me" },
  {
    name: "Instagram",
    color: "#E4405F",
    href: "https://instagram.com/mualim.academy",
  },
] as const;

export const NAV_PRIMARY = [
  { label: 'Башкы бет', href: '/' },
  { label: 'Устаз', href: '/ustaz' },
] as const;

export const NAV_MENU = [
  { label: 'Суроо-жооп', href: '/questions' },
  { label: 'Курстар', href: '/courses' },
  { label: 'Намаз', href: '/#prayer' },
  { label: 'Байланыш', href: '/#contact' },
  { label: 'Баяндар', href: '/#videos' },
] as const;

export const LANG_OPTIONS = [
  { value: 'kg', label: 'KG' },
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
] as const;

export type LangCode = (typeof LANG_OPTIONS)[number]['value'];

export const STATS = [
  { value: "1200+", label: "Баяндар" },
  { value: "350+", label: "Видеолор" },
  { value: "85 000+", label: "Көрүүчүлөр" },
  { value: "15+", label: "Жылдык кызмат" },
] as const;

export const QUICK_ACCESS = [
  { label: "Намаз убакыттары", href: "/#prayer", emoji: "🕌" },
  { label: "Курстар", href: "/courses", emoji: "📖" },
  { label: "Дубалар", href: "/#ayah", emoji: "🤲" },
  { label: "Акыркы баян", href: "/#videos", emoji: "▶️" },
  { label: "Cуроо-жооп", href: "/questions", emoji: "💬" },
  { label: "Устаз", href: "/ustaz", emoji: "👤" },
] as const;

export const FREE_VIDEOS = [
  {
    id: "ZkpJ1ezB2TI",
    title: "Тойдо музыка койсо туурабы?",
    date: "2025-07-25",
    duration: "45:20",
    thumbnail: "https://img.youtube.com/vi/ZkpJ1ezB2TI/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=ZkpJ1ezB2TI",
  },
  {
    id: "jWh55FxqLhQ",
    title: "Батасыз баш кошуу туурабы?",
    date: "2025-07-24",
    duration: "18:30",
    thumbnail: "https://img.youtube.com/vi/jWh55FxqLhQ/mqdefault.jpg",
    url: "https://www.youtube.com/watch?v=jWh55FxqLhQ",
  },
  {
    id: "iBn8RH4GSko",
    title: "Сулуулугуна караш керекпи?",
    date: "2025-07-23",
    duration: "22:15",
    thumbnail: "https://img.youtube.com/vi/iBn8RH4GSko/mqdefault.jpg",
    url: "https://www.youtube.com/watch?v=iBn8RH4GSko",
  },
  {
    id: "-x5ZVt-W1Yg",
    title: "Эмне керек үйлөнүүгө?",
    date: "2025-07-22",
    duration: "15:40",
    thumbnail: "https://img.youtube.com/vi/-x5ZVt-W1Yg/mqdefault.jpg",
    url: "https://www.youtube.com/watch?v=-x5ZVt-W1Yg",
  },
  {
    id: "jWh55FxqLhQ-2",
    title: "Намаздын мааниси",
    date: "2025-07-21",
    duration: "12:05",
    thumbnail: "https://img.youtube.com/vi/jWh55FxqLhQ/mqdefault.jpg",
    url: "https://www.youtube.com/watch?v=jWh55FxqLhQ",
  },
] as const;

const YT_IDS = [
  "ZkpJ1ezB2TI",
  "jWh55FxqLhQ",
  "iBn8RH4GSko",
  "-x5ZVt-W1Yg",
] as const;

function courseIntro(index: number, duration: string, date: string) {
  const vid = YT_IDS[index % YT_IDS.length];
  return {
    id: `intro-${index}`,
    title: "Киришүү сабак",
    duration,
    date,
    videoId: vid,
    thumbnail: `https://img.youtube.com/vi/${vid}/mqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${vid}`,
  };
}

export const PAID_COURSES = [
  {
    id: "family",
    title: "Үй-бүлөлүк бакыт",
    price: "4 500 сом",
    lessons: 12,
    rating: 5.0,
    intro: courseIntro(0, "10:15", "2025-07-18"),
  },
  {
    id: "tasawuf",
    title: "Тасауф илими",
    price: "4 000 сом",
    lessons: 12,
    rating: 4.9,
    intro: courseIntro(1, "09:40", "2025-07-17"),
  },
  {
    id: "fiqh",
    title: "Фикh",
    price: "3 800 сом",
    lessons: 12,
    rating: 4.9,
    intro: courseIntro(2, "11:05", "2025-07-16"),
  },
  {
    id: "aqida",
    title: "Акыйда",
    price: "3 500 сом",
    lessons: 12,
    rating: 4.8,
    intro: courseIntro(3, "08:50", "2025-07-15"),
  },
  {
    id: "basics",
    title: "Ислам негиздери",
    price: "3 200 сом",
    lessons: 10,
    rating: 4.8,
    intro: courseIntro(0, "12:20", "2025-07-14"),
  },
  {
    id: "quran",
    title: "Куран окуу",
    price: "3 600 сом",
    lessons: 14,
    rating: 4.9,
    intro: courseIntro(1, "14:10", "2025-07-13"),
  },
  {
    id: "sunnah",
    title: "Сүннөт негиздери",
    price: "3 400 сом",
    lessons: 11,
    rating: 4.7,
    intro: courseIntro(2, "09:55", "2025-07-12"),
  },
  {
    id: "dua",
    title: "Дубалар",
    price: "2 800 сом",
    lessons: 8,
    rating: 4.8,
    intro: courseIntro(3, "07:30", "2025-07-11"),
  },
  {
    id: "ramadan",
    title: "Рамазан даярдыгы",
    price: "3 000 сом",
    lessons: 9,
    rating: 4.9,
    intro: courseIntro(0, "11:45", "2025-07-10"),
  },
  {
    id: "kids",
    title: "Балдар тарbiyasy",
    price: "3 300 сом",
    lessons: 10,
    rating: 4.8,
    intro: courseIntro(1, "10:05", "2025-07-09"),
  },
  {
    id: "akhlaq",
    title: "Адеп-ахлак",
    price: "3 100 сом",
    lessons: 10,
    rating: 4.7,
    intro: courseIntro(2, "08:40", "2025-07-08"),
  },
  {
    id: "zakat",
    title: "Зeket жана сadaка",
    price: "2 900 сом",
    lessons: 8,
    rating: 4.8,
    intro: courseIntro(3, "09:15", "2025-07-07"),
  },
] as const;

export const PRAYER_TIMES = [
  { name: "Фажр", time: "04:12", phase: "new" as const },
  { name: "Күн чыгыш", time: "05:45", phase: "waxing" as const },
  { name: "Бешим", time: "13:10", phase: "full" as const, active: true },
  { name: "Аср", time: "17:25", phase: "waning" as const },
  { name: "Шам", time: "20:15", phase: "crescent" as const },
  { name: "Куптан", time: "21:45", phase: "night" as const },
] as const;

export const CITIES = [
  "Бишкек",
  "Ош",
  "Жалал-Абад",
  "Каракол",
  "Талас",
] as const;

export const HADITH = {
  text: "«Амалдар тек ниеттерге карата болот. Ар бир киши не ниет кылса, ошонун эле акыбетин көрөт.»",
  source: "Бухари, 1",
};

export const AYAH = {
  arabic: "رَبِّ زِدْنِي عِلْمًا",
  translation: "Эжеби, менин билимимди арттыр",
  source: "Taha, 114",
};

export const EVENTS = [
  {
    date: "13",
    month: "Июн",
    title: "Семинар: Үй-бүлө баалуулуктары",
    location: "Талас",
    time: "09:30",
  },
  {
    date: "22",
    month: "Мар",
    title: "Онлайн курс: Ислам негиздери",
    location: "Онлайн",
    time: "18:00",
  },
  {
    date: "01",
    month: "Апр",
    title: "Рамазан даярдыгы",
    location: "Бишкек",
    time: "10:00",
  },
] as const;

export const TEACHER = {
  name: "Мухаммадалим Халил",
  shortName: "Muhammadalim",
  institute: "Кара-Балта ш., «Хазрети Осмон» ислам институту",
  role: "Директордун орун басары",
  quote: "БИЛИМ МЕНЕН КУРАЛДАН, АДЕП МЕНЕН ЖОЛ ТАП, ЭМГЕК МЕНЕН БИЙИКТЕ.",
  quoteSub: "",
  teaserBio:
    "«Хазрети Осмон» ислам институтунун директордун орун басары. YouTube каналында бекер баяндар жана Mualim Academy платформасында онлайн курстарды жүргүзөт.",
  bio: "«Хазрети Осмон» ислам институтунун директордун орун басары. Араб, перс, түрк тилдеринде билим берет. Куран, фикh, тафсир жана суфизм темаларында сабак берет.",
  fullBio:
    "Мухаммадалим Халил — Кара-Балта шаарындагы «Хазрети Осмон» ислам институтунун директордун орун басары. 2007-жылдан баштап ислам билимин алган, Тажикистан, Түркия жана Иорданияда окуган. 2016-жылдан бери институтта устаз, бөлüm башчысы жана директордун орун басары болуп иштейт. YouTube каналында бекер баяндарды, Mualim Academy платформасында онлайн курстарды жүргүзөт.",
  education: [
    {
      period: "2007–2011",
      place: "«Хазрети Осмон» ислам институту",
      city: "Кара-Балта, Кыргызстан",
      focus: "Араб тилинин преподаватели, имам-хатиб",
    },
    {
      period: "2011–2016",
      place: "Устаз Хазрат Хикматулло медресеси",
      city: "Тажикистан",
      focus: "Араб грамматикасы, перс тилinin адисi",
    },
    {
      period: "2016–2017",
      place: "Махмуд эфенди медресеси",
      city: "Түркия",
      focus: "Суфизм",
    },
    {
      period: "2017–2018",
      place: "Устаз Хазрат Хикматулло медресеси",
      city: "Тажикистан",
      focus: "Куран тафсир илими адиси",
    },
    {
      period: "2021–2023",
      place: "Жордания дүйнөлүк ислам илимдери университети",
      city: "Иордания — Ханафи фикхи факультети",
      focus: "Ханафи фикхи жана юриспруденция адиси",
    },
    {
      period: "2021–2023",
      place: "«Ифта у тафких» атындагы ханафий юриспруденция лигасы",
      city: "Иордания",
      focus: "Фатва адиси",
    },
  ] as const,
  workExperience: [
    {
      period: "2016–2018",
      place: "«Хазрети Осмон» ислам институту",
      city: "Кара-Балта, Кыргызстан",
      role: "Устаз (преподаватель)",
    },
    {
      period: "2018–2021",
      place: "«Хазрети Осмон» ислам институту",
      city: "Кара-Балта, Кыргызстан",
      role: "Кыздар билим берүү бөлүмүнүн башчысы",
    },
    {
      period: "2023",
      place: "«Хазрети Осмон» ислам институту",
      city: "Кара-Балта, Кыргызстан",
      role: "Директордун орун басары",
    },
  ] as const,
  languages: [
    { name: "Кыргызча", level: "Эне тили" },
    { name: "Орусча", level: "Эрkin" },
    { name: "Арабча", level: "Эрkin" },
    { name: "Түркчө", level: "Эрkin" },
    { name: "Персче", level: "Эрkin" },
  ] as const,
  additionalInfo: [
    "Компьютерди жана офис программаларын (Excel, Word) ишке ашыра алат",
    "Айдоочу күбөлүгү: «B», «C» категориялары",
  ] as const,
  personalQualities:
    "Энергиялуу, жогорку ишке кабилеттүүлүк. Тартиптүү, демилгечи жана коммуникабелдик. Жоопкерчиликтүү, принципиалдуу, максатка умтулган. Аткарган ишине чынчыл мамиле кылат.",
  stats: [
    { value: "1200+", label: "Баяндар" },
    { value: "15+", label: "Жыл тажрыйба" },
    { value: "85 000+", label: "Көрүүчүлөр" },
  ],
  topics: [
    {
      icon: "book" as const,
      title: "Куран жана Сүннөт",
      desc: "Куран аяттарынын жана хадистердин негизинде ишенимдүү маалымат.",
    },
    {
      icon: "book" as const,
      title: "Фикh жана акыйда",
      desc: "Ислам укугу жана негизги ишеним маселелери боюнча терең сабakтар.",
    },
    {
      icon: "grad" as const,
      title: "Тasauф илими",
      desc: "Жүрөктү tazaloo жана Аллаhка жakын болуу жолдору.",
    },
    {
      icon: "grad" as const,
      title: "Үй-бүлөлүк бакыт",
      desc: "Үй-бүлө, ата-ене жана балдар боюнча практикалык кеңештер.",
    },
  ],
};

export const SOCIAL = [
  {
    name: "YouTube",
    color: "#FF0000",
    href: "https://youtube.com/@Muhammadalim_Halil",
  },
  { name: "Telegram", color: "#0088cc", href: "https://t.me" },
  {
    name: "Instagram",
    color: "#E4405F",
    href: "https://instagram.com/mualim.academy",
  },
  { name: "WhatsApp", color: "#25D366", href: "https://wa.me" },
] as const;

export const FAQ = [
  {
    q: "Бекер сабактар кайдан алынат?",
    a: "YouTube канал @Muhammadalim_Halil.",
  },
  {
    q: "Акылуу курстарга кантип кирүү?",
    a: "Төлөгөндөн кийин жеке кабинетте бардык сабактар ачылат.",
  },
  {
    q: "Сертификат кандай берилет?",
    a: "Бардык сабактарды аяктап, тесттерден 80% топтогондон кийин PDF форматында.",
  },
] as const;
