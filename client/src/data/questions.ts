export type QuestionSort = 'default' | 'newest' | 'oldest' | 'popular';

export type QuestionArticle = {
  id: string;
  title: string;
  excerpt: string;
  views: number;
  publishedAt: string;
  type: 'text' | 'video';
};

export const QUESTIONS_PER_PAGE = 10;

export const QUESTION_ARTICLES: QuestionArticle[] = [
  {
    id: 'draw-people-islam',
    title: 'Исламда адамды сүрөткө тартууга болобу? Коран жана хадистер эмне дейт',
    excerpt:
      'Мусулман адам портреттерди жана адам сүрөттөрүн тартууга болобу? Чынында эле сүрөтчү өз эмгектерине «жан» берүүгө тарыйбы? Кайсы учурларда сүрөт тартуу тыюу салынат?',
    views: 4862,
    publishedAt: '2025-11-18',
    type: 'text',
  },
  {
    id: 'hajj-period',
    title: 'Хадж же умра учурунда айыз: менструацияны кийинкиге калтырууга болобу?',
    excerpt:
      'Эгер айыз хадж же умрага дал келсе эмне кылуу кerek? Паломничество алдында циклди медициналык жол менен жөнгө салууга уруксат барбы?',
    views: 5063,
    publishedAt: '2025-11-10',
    type: 'text',
  },
  {
    id: 'amin-after-dua',
    title: 'Дуадан кийин «амин»: айтуу кerekпи жана Исламда эмне дегенди билдирет',
    excerpt:
      'Дуадан кийин «амин» айтуу кerekпи жана бул Исламда канчалык маанилүү? «Амин» сөзү эмнени билдирет?',
    views: 17160,
    publishedAt: '2025-10-28',
    type: 'text',
  },
  {
    id: 'hajj-menstruation',
    title: 'Хадж жана айыз: айыз учурунда хадж жана умра аткарууга болобu?',
    excerpt:
      'Хадж жана айыз — паломничество жөнөгөн аялдар арасында эң көп берилүүчү сурoолордун бири. Айыз учурунда таваф аткарууга болобu?',
    views: 13228,
    publishedAt: '2025-10-15',
    type: 'text',
  },
  {
    id: 'easter-kulich',
    title: 'Пасха куличтери: мусулмандарга болобu? Халal же харам',
    excerpt:
      'Мусулмандарга пасха куличтерин жешке болобu? Бул харамбы же уруксаттуубu?',
    views: 36883,
    publishedAt: '2025-09-30',
    type: 'text',
  },
  {
    id: 'predator-meat',
    title: 'Исламда жырткыч жаныбарлардын eti: халal же харам',
    excerpt:
      'Мусулмандарга жырткыч жаныбарлардын eti жешке болобu? Тishтүү жырткычтар жана тырмагы бар канаттуулар тууралуу хadistер.',
    views: 9854,
    publishedAt: '2025-09-12',
    type: 'text',
  },
  {
    id: 'nifaq-hypocrisy',
    title: 'Исламда эки жүздүүлүк (нифак): мунафик ким?',
    excerpt: 'Ислам көз карашыndan эки жүздүүлүк деген эмне? Мунафик ким, нифак эмне?',
    views: 20784,
    publishedAt: '2025-08-25',
    type: 'text',
  },
  {
    id: 'missed-prayers',
    title: 'Намаз карызын төлөөгө болобu? Калтырылган намаздар',
    excerpt: 'Калтырылган милдettүү намаздарды кайra атkaruu жана намаз карызы тууралуу сурoо.',
    views: 22691,
    publishedAt: '2025-08-08',
    type: 'text',
  },
  {
    id: 'friday-ghusl',
    title: 'Жuma күнү жана толук гусул',
    excerpt: 'Мечетке жuma namazına барuudan mурda gusul атkaruu туuraлуu сурoо.',
    views: 16662,
    publishedAt: '2025-07-20',
    type: 'text',
  },
  {
    id: 'juma-quorum',
    title: 'Жuma namazын атkaruu үчүн керektүү минимalдуu жamaat',
    excerpt: 'Джuma namazын атkaruu үчүн мечетте канча киши болушu кerek.',
    views: 15561,
    publishedAt: '2025-07-05',
    type: 'text',
  },
  {
    id: 'dog-islam',
    title: 'Исламда ит — ойдon чыgarылган тыюубу?',
    excerpt: 'Ит Исламда kir жаныбар деп эсеptelenet бe? Пайгамбар ﷺ жөнүндөгү хadistер аркылuu тaldaп көрүлөт.',
    views: 8420,
    publishedAt: '2025-08-12',
    type: 'video',
  },
  {
    id: 'music-islam',
    title: 'Исламда музыка — ойдon чыgarылган тыюубu?',
    excerpt: 'Музыка Исламда эң көп тalkuulanган сурoолордун бири. Корan аяттары, хadistер жана аалымдардын пikirleri.',
    views: 12450,
    publishedAt: '2025-08-05',
    type: 'video',
  },
];

export const QUESTION_SORT_OPTIONS: { value: QuestionSort; label: string }[] = [
  { value: 'default', label: 'Демейки боюнча' },
  { value: 'newest', label: 'Алгач жаңылары' },
  { value: 'oldest', label: 'Алгач эскилери' },
  { value: 'popular', label: 'Алгач популярдуулары' },
];

export function sortQuestions(articles: QuestionArticle[], sort: QuestionSort) {
  const list = [...articles];
  switch (sort) {
    case 'newest':
      return list.sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
    case 'oldest':
      return list.sort(
        (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
      );
    case 'popular':
      return list.sort((a, b) => b.views - a.views);
    default:
      return list;
  }
}

export function filterQuestions(articles: QuestionArticle[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return articles;
  return articles.filter(
    (a) => a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q),
  );
}

export function getQuestionById(id: string) {
  return QUESTION_ARTICLES.find((a) => a.id === id);
}

export function formatQuestionDate(iso: string) {
  const d = new Date(iso);
  const months = [
    'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
  ] as const;
  return `${d.getDate()}-${months[d.getMonth()]}, ${d.getFullYear()}`;
}

export function formatViews(count: number) {
  return count.toLocaleString('ru-RU');
}
