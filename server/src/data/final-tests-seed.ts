export type SeedChoiceQuestion = {
  questionType: 'choice';
  questionText: string;
  explanation?: string;
  options: [
    { optionText: string; isCorrect: boolean; optionOrder: 1 },
    { optionText: string; isCorrect: boolean; optionOrder: 2 },
    { optionText: string; isCorrect: boolean; optionOrder: 3 },
    { optionText: string; isCorrect: boolean; optionOrder: 4 },
  ];
};

export type SeedFinalTest = {
  title: string;
  passingScore: number;
  questions: SeedChoiceQuestion[];
};

export const FINAL_TESTS_BY_SLUG: Record<string, SeedFinalTest> = {
  akyluu: {
    title: 'tasauf — курстук тест',
    passingScore: 90,
    questions: [
      {
        questionType: 'choice',
        questionText: 'Тасауф (тасаввуф) деген эмне?',
        options: [
          { optionText: 'Жүрөктү тазалоо жана Аллахка ыкылас менен жакындашуу', isCorrect: true, optionOrder: 1 },
          { optionText: 'Дүйнөлүк байлык жыйноо', isCorrect: false, optionOrder: 2 },
          { optionText: 'Саясий илим үйрөнүү', isCorrect: false, optionOrder: 3 },
          { optionText: 'Спорт машыгуусу', isCorrect: false, optionOrder: 4 },
        ],
      },
      {
        questionType: 'choice',
        questionText: 'Тасауфтун негизги максаты эмне?',
        options: [
          { optionText: 'Напсини тарбиялап, ыйманды чыңдоо', isCorrect: true, optionOrder: 1 },
          { optionText: 'Адамдарды жек көрүү', isCorrect: false, optionOrder: 2 },
          { optionText: 'Намазды таштоо', isCorrect: false, optionOrder: 3 },
          { optionText: 'Дүйнөдөн далилсиз баш тартуу', isCorrect: false, optionOrder: 4 },
        ],
      },
      {
        questionType: 'choice',
        questionText: 'Ыкылас деген эмне?',
        options: [
          { optionText: 'Ишти жалгыз Аллах үчүн кылуу', isCorrect: true, optionOrder: 1 },
          { optionText: 'Адамдарга көрүнүү үчүн иштөө', isCorrect: false, optionOrder: 2 },
          { optionText: 'Тек сөз айтуу', isCorrect: false, optionOrder: 3 },
          { optionText: 'Мал-мүлккө умтулуу', isCorrect: false, optionOrder: 4 },
        ],
      },
      {
        questionType: 'choice',
        questionText: 'Тасауф эмнеге негизделет?',
        options: [
          { optionText: 'Куранга жана Сүннөткө', isCorrect: true, optionOrder: 1 },
          { optionText: 'Жеке ойго гана', isCorrect: false, optionOrder: 2 },
          { optionText: 'Башка диндерге', isCorrect: false, optionOrder: 3 },
          { optionText: 'Далилсиз салтка гана', isCorrect: false, optionOrder: 4 },
        ],
      },
      {
        questionType: 'choice',
        questionText: 'Жүрөктү тазалоодо эмне маанилүү?',
        options: [
          { optionText: 'Зикир, тооба жана жакшы ахляк', isCorrect: true, optionOrder: 1 },
          { optionText: 'Тек көп уктоо', isCorrect: false, optionOrder: 2 },
          { optionText: 'Адамдарды гайбат кылуу', isCorrect: false, optionOrder: 3 },
          { optionText: 'Намазды таштоо', isCorrect: false, optionOrder: 4 },
        ],
      },
    ],
  },
  akhlaq: {
    title: 'Адеп-ахлак — курстук тест',
    passingScore: 90,
    questions: [
      {
        questionType: 'choice',
        questionText: 'Адеп-ахлак деген эмне?',
        options: [
          { optionText: 'Жалгыз намаз окуу', isCorrect: false, optionOrder: 1 },
          { optionText: 'Жакшы мүнөз, чынчыл мамиле жана туура жүрүм-турум', isCorrect: true, optionOrder: 2 },
          { optionText: 'Куран жаттоо гана', isCorrect: false, optionOrder: 3 },
          { optionText: 'Оrozо кармоо', isCorrect: false, optionOrder: 4 },
        ],
      },
      {
        questionType: 'choice',
        questionText: 'Исламда ата-энеге мамиле кандай болушу керек?',
        options: [
          { optionText: 'Аларды урматтоо, ырайым кылуу жана жакшы сөз айтуу', isCorrect: true, optionOrder: 1 },
          { optionText: 'Алар менен сүйлөшпөө', isCorrect: false, optionOrder: 2 },
          { optionText: 'Аларды эск албай койуу', isCorrect: false, optionOrder: 3 },
          { optionText: 'Тек гана акча жиберүү', isCorrect: false, optionOrder: 4 },
        ],
      },
      {
        questionType: 'choice',
        questionText: 'Тилди сактоо эмнеси?',
        options: [
          { optionText: 'Көп сүйлөө', isCorrect: false, optionOrder: 1 },
          { optionText: 'Жалган сөздөрдү айтуу', isCorrect: false, optionOrder: 2 },
          { optionText: 'Жалган эмес, чынчыл жана пайдалуу сөз айтуу', isCorrect: true, optionOrder: 3 },
          { optionText: 'Эч ким менен сүйлөшпөө', isCorrect: false, optionOrder: 4 },
        ],
      },
    ],
  },
  family: {
    title: 'Үй-бүлөлүк бакыт — курстук тест',
    passingScore: 90,
    questions: [
      {
        questionType: 'choice',
        questionText: 'Бактылуу үй-бүлөдө эмне маанилуу?',
        options: [
          { optionText: 'Бири-бирине урмат, сабыр жана чынчыл мамиле', isCorrect: true, optionOrder: 1 },
          { optionText: 'Тек материалдык байлык', isCorrect: false, optionOrder: 2 },
          { optionText: 'Бири-бирине сүйлөшпөө', isCorrect: false, optionOrder: 3 },
          { optionText: 'Күн сайын урушуу', isCorrect: false, optionOrder: 4 },
        ],
      },
      {
        questionType: 'choice',
        questionText: 'Жубайлар ортосундагы мамиледе неге басым коюлат?',
        options: [
          { optionText: 'Сабыр, түшүнүү жана жакшы сөз', isCorrect: true, optionOrder: 1 },
          { optionText: 'Башкычылык', isCorrect: false, optionOrder: 2 },
          { optionText: 'Кек', isCorrect: false, optionOrder: 3 },
          { optionText: 'Кайдыгерлик', isCorrect: false, optionOrder: 4 },
        ],
      },
      {
        questionType: 'choice',
        questionText: 'Баланы тарбиялоодо не маанилuu?',
        options: [
          { optionText: 'Мисал менен жакшы мүнөздү үйрөтүү', isCorrect: true, optionOrder: 1 },
          { optionText: 'Тек жазалоо', isCorrect: false, optionOrder: 2 },
          { optionText: 'Керек нерселерди айтпоо', isCorrect: false, optionOrder: 3 },
          { optionText: 'Баланы эч качан угуу', isCorrect: false, optionOrder: 4 },
        ],
      },
    ],
  },
};

export function buildGenericFinalTest(courseTitle: string): SeedFinalTest {
  return {
    title: `${courseTitle} — курстук тест`,
    passingScore: 90,
    questions: [
      {
        questionType: 'choice',
        questionText: `"${courseTitle}" курсунун негизги максаты эмне?`,
        options: [
          { optionText: 'Ислам боюнча билимди тереңдетүү', isCorrect: true, optionOrder: 1 },
          { optionText: 'Тек оюн ойноо', isCorrect: false, optionOrder: 2 },
          { optionText: 'Эч нерсени үйрөнбөө', isCorrect: false, optionOrder: 3 },
          { optionText: 'Сабактарды өткөрүп жиберүү', isCorrect: false, optionOrder: 4 },
        ],
      },
      {
        questionType: 'choice',
        questionText: 'Курсту аяктоодо студент эмне кылууга тийиш?',
        options: [
          { optionText: 'Сабактарды кайра көрүп, үйрөнгөнүн колдонуу', isCorrect: true, optionOrder: 1 },
          { optionText: 'Бардык видеолорду өткөрүп жиберүү', isCorrect: false, optionOrder: 2 },
          { optionText: 'Тестти тапшырбай коюу', isCorrect: false, optionOrder: 3 },
          { optionText: 'Курстан чыгып кетүү', isCorrect: false, optionOrder: 4 },
        ],
      },
      {
        questionType: 'choice',
        questionText: 'Сертификат алуу үчүн финалдык тестте канча % топтоо керек?',
        options: [
          { optionText: '50%', isCorrect: false, optionOrder: 1 },
          { optionText: '70%', isCorrect: false, optionOrder: 2 },
          { optionText: '90% жана андан жогору', isCorrect: true, optionOrder: 3 },
          { optionText: '10%', isCorrect: false, optionOrder: 4 },
        ],
      },
    ],
  };
}
