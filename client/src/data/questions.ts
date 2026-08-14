import telegramQuestionsData from './telegram-questions.json';
import type { QuestionArticle, QuestionSort } from '../lib/qa-api';

export type { QuestionArticle, QuestionSort };

export const QUESTIONS_PER_PAGE = 10;

export const QUESTION_SORT_OPTIONS: { value: QuestionSort; label: string }[] = [
  { value: 'default', label: '№ боюнча (1, 2, 3…)' },
  { value: 'newest', label: 'Алгач жаңылары' },
  { value: 'oldest', label: 'Алгач эскилери' },
  { value: 'popular', label: 'Алгач популярдуулары' },
];

type TelegramQuestion = {
  id: string;
  number?: number;
  question: string;
  answer: string;
  tags?: string[];
  publishedAt: string;
  views?: number;
};

function telegramToArticle(item: TelegramQuestion): QuestionArticle {
  return {
    id: item.id,
    number: item.number,
    title: item.question,
    question: item.question,
    answer: item.answer,
    excerpt: item.answer.length > 160 ? `${item.answer.slice(0, 160).trim()}…` : item.answer,
    tags: item.tags,
    views: item.views ?? 0,
    publishedAt: item.publishedAt,
    type: 'text',
    source: 'telegram',
  };
}

const LEGACY_ARTICLES: QuestionArticle[] = [
  {
    id: 'draw-people-islam',
    title: 'Исламда адамды сүрөткө тартууга болобу? Коран жана хадистер эмне дейт',
    excerpt:
      'Мусулман адам портреттерди жана адам сүрөттөрүн тартууга болобу? Чынында эле сүрөтчү өз эмгектерине «жан» берүүгө тарыйбы? Кайсы учурларда сүрөт тартуу тыюу салынат?',
    views: 4862,
    publishedAt: '2025-11-18',
    type: 'text',
    source: 'article',
  },
  {
    id: 'hajj-period',
    title: 'Хадж же умра учурунда айыз: менструацияны кийинкиге калтырууга болобу?',
    excerpt:
      'Эгер айыз хадж же умрага дал келсе эмне кылуу кerek? Паломничество алдында циклди медициналык жол менен жөнгө салууга уруксат барбы?',
    views: 5063,
    publishedAt: '2025-11-10',
    type: 'text',
    source: 'article',
  },
  {
    id: 'amin-after-dua',
    title: 'Дуадан кийин «амин»: айтуу кerekпи жана Исламда эмне дегенди билдирет',
    excerpt:
      'Дуадан кийин «амин» айтуу кerekпи жана бул Исламда канчалык маанилүү? «Амин» сөзү эмнени билдирет?',
    views: 17160,
    publishedAt: '2025-10-28',
    type: 'text',
    source: 'article',
  },
  {
    id: 'hajj-menstruation',
    title: 'Хадж жана айыз: айыз учурунда хадж жана умра аткарууга болобu?',
    excerpt:
      'Хадж жана айыз — паломничество жөнөгөн аялдар арасында эң көп берилүүчү сурoолордун бири. Айыз учурунда таваф аткарууга болобu?',
    views: 13228,
    publishedAt: '2025-10-15',
    type: 'text',
    source: 'article',
  },
  {
    id: 'easter-kulich',
    title: 'Пасха куличтери: мусулмандарга болобu? Халal же харам',
    excerpt:
      'Мусулмандарга пасха куличтерин жешке болобu? Бул харамбы же уруксаттуубu?',
    views: 36883,
    publishedAt: '2025-09-30',
    type: 'text',
    source: 'article',
  },
  {
    id: 'predator-meat',
    title: 'Исламда жырткыч жаныбарлардын eti: халal же харам',
    excerpt:
      'Мусулмандарга жырткыч жаныбарлардын eti жешке болобu? Тishтүү жырткычтар жана тырмагы бар канаттуулар тууралуу хadistер.',
    views: 9854,
    publishedAt: '2025-09-12',
    type: 'text',
    source: 'article',
  },
  {
    id: 'nifaq-hypocrisy',
    title: 'Исламда эки жүздүүлүк (нифак): мунафик ким?',
    excerpt: 'Ислам көз карашыndan эки жүздүүлүк деген эмне? Мунафик ким, нифак эмне?',
    views: 20784,
    publishedAt: '2025-08-25',
    type: 'text',
    source: 'article',
  },
  {
    id: 'missed-prayers',
    title: 'Намаз карызын төлөөгө болобu? Калтырылган намаздар',
    excerpt: 'Калтырылган милдettүү намаздарды кайra атkaruu жана намаз карызы тууралуу сурoо.',
    views: 22691,
    publishedAt: '2025-08-08',
    type: 'text',
    source: 'article',
  },
  {
    id: 'friday-ghusl',
    title: 'Жuma күнү жана толук гусул',
    excerpt: 'Мечетке жuma namazına барuudan mурda gusul атkaruu туuraлуu сурoо.',
    views: 16662,
    publishedAt: '2025-07-20',
    type: 'text',
    source: 'article',
  },
  {
    id: 'juma-quorum',
    title: 'Жuma namazын атkaruu үчүн керektүү минимalдуu жamaat',
    excerpt: 'Джuma namazын атkaruu үчүн мечетте канча киши болушu кerek.',
    views: 15561,
    publishedAt: '2025-07-05',
    type: 'text',
    source: 'article',
  },
  {
    id: 'dog-islam',
    title: 'Исламда ит — ойдon чыgarылган тыюубу?',
    excerpt: 'Ит Исламда kir жаныбар деп эсеptelenet бe? Пайгамбар ﷺ жөнүндөгү хadistер аркылuu тaldaп көрүлөт.',
    views: 8420,
    publishedAt: '2025-08-12',
    type: 'video',
    source: 'article',
  },
  {
    id: 'music-islam',
    title: 'Исламда музыка — ойдon чыgarылган тыюубu?',
    excerpt: 'Музыка Исламда эң көп тalkuulanган сурoолордун бири. Корan аяттары, хadistер жана аалымдардын пikirleri.',
    views: 12450,
    publishedAt: '2025-08-05',
    type: 'video',
    source: 'article',
  },
];

const TELEGRAM_FALLBACK = (telegramQuestionsData as TelegramQuestion[]).map(telegramToArticle);

/** API иштебese — статикалык fallback */
export const FALLBACK_QUESTIONS: QuestionArticle[] = [...TELEGRAM_FALLBACK, ...LEGACY_ARTICLES];

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
      return list.sort((a, b) => {
        const an = a.number ?? Number.MAX_SAFE_INTEGER;
        const bn = b.number ?? Number.MAX_SAFE_INTEGER;
        if (an !== bn) return an - bn;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
  }
}

export function filterQuestions(articles: QuestionArticle[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return articles;
  return articles.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      a.question?.toLowerCase().includes(q) ||
      a.answer?.toLowerCase().includes(q) ||
      a.tags?.some((tag) => tag.toLowerCase().includes(q)),
  );
}

export function getFallbackQuestionById(id: string) {
  return FALLBACK_QUESTIONS.find((a) => a.id === id);
}

export function formatQuestionDate(iso: string) {
  const d = new Date(iso);
  const months = [
    'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
  ] as const;
  return `${d.getDate()}-${months[d.getMonth()]}, ${d.getFullYear()}`;
}

export function formatQuestionNumber(number?: number | null) {
  if (number == null) return null;
  return `№${number}`;
}

export function formatQuestionTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatViews(count: number) {
  return count.toLocaleString('ru-RU');
}
