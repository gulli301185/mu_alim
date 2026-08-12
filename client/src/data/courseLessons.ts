import { PAID_COURSES } from './landing';

const YT_IDS = [
  'ZkpJ1ezB2TI',
  'jWh55FxqLhQ',
  'iBn8RH4GSko',
  '-x5ZVt-W1Yg',
] as const;

const LESSON_TITLES = [
  'Киришүү',
  'Негизги түшүнүктөр',
  'Практикалык сабак',
  'Тереңирээк изилдөө',
  'Кайталоо',
  'Кошумча материал',
  'Суроо-жооп',
  'Колдонмо',
  'Мисалдар',
  'Жыйынтык',
  'Текшерүү',
  'Аяктоо',
  'Бонус сабак',
  'Кошумча видео',
] as const;

export type LessonTest = {
  question: string;
  options: string[];
  correctIndex: number;
};

export type CourseLesson = {
  id: string;
  order: number;
  title: string;
  duration: string;
  videoId: string;
  tests: LessonTest[];
};

function lessonDuration(index: number): string {
  const mins = 8 + (index % 7);
  const secs = (index * 13) % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function buildTests(lessonTitle: string, courseTitle: string): LessonTest[] {
  return [
    {
      question: `«${lessonTitle}» сабагы кайсы курска таандык?`,
      options: [courseTitle, 'Башка курс', 'Бекер баян', 'Намаз убакыттары'],
      correctIndex: 0,
    },
    {
      question: 'Кийинки сабак ачылуу шарты кандай?',
      options: [
        'Мурунку видео көрүлүп, тест тапшырылган болушу кerek',
        'Төлөм гана жетиштүү',
        'Каалаган убакта',
        'Автоматтык ачылат',
      ],
      correctIndex: 0,
    },
  ];
}

export function getCourseById(courseId: string) {
  return PAID_COURSES.find((c) => c.id === courseId);
}

export function buildCourseLessons(courseId: string): CourseLesson[] {
  const course = getCourseById(courseId);
  if (!course) return [];

  return Array.from({ length: course.lessons }, (_, index) => {
    const order = index + 1;
    const title = LESSON_TITLES[index % LESSON_TITLES.length];
    return {
      id: `${courseId}-lesson-${order}`,
      order,
      title: `${order}-сабак: ${title}`,
      duration: lessonDuration(index),
      videoId: YT_IDS[index % YT_IDS.length],
      tests: buildTests(title, course.title),
    };
  });
}

export function isLessonUnlocked(
  lessons: CourseLesson[],
  lessonId: string,
  completedLessonIds: string[],
): boolean {
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index <= 0) return true;
  const prev = lessons[index - 1];
  return completedLessonIds.includes(prev.id);
}
