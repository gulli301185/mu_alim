import { PAID_COURSES } from './landing';
import type { LessonDto } from '../lib/lesson-api';

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

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
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
        'Мурунку видео көрүлүп, тест тапшырылган болушу керек',
        'Төлөм гана жетиштүү',
        'Каалаган убакта',
        'Автоматтык ачылат',
      ],
      correctIndex: 0,
    },
    {
      question: 'Тест ийгиликтүү деп эсептелүү үчүн канча пайыз керек?',
      options: ['80% жана жогору', '50%', '100%', '60%'],
      correctIndex: 0,
    },
    {
      question: 'Видеону көргөндөн кийин эмне ачылат?',
      options: ['Сабак боюнча тест', 'Кийинки курс', 'Жаңы каттоо', 'Эч нерсе'],
      correctIndex: 0,
    },
    {
      question: 'Тест ийгиликсиз болсо эмне кылуу керек?',
      options: [
        'Видеону кайра көрүп, тестти кайра тапшыруу',
        'Курсду таштап коюу',
        'Кийинки видеого өтүү',
        'Колдонуу шарттарын өзгөртүү',
      ],
      correctIndex: 0,
    },
    {
      question: 'Курс материалдарын үчүнчү жактарга берүүгө уруксат барбы?',
      options: ['Жок, тыюу салынат', 'Ооба, эркин', 'Жеке макулдук менен', '15 күнөн кийин'],
      correctIndex: 0,
    },
  ];
}

export function getCourseById(courseId: string) {
  return PAID_COURSES.find((c) => c.id === courseId);
}

export function mapLessonsToCourseLessons(
  apiLessons: LessonDto[],
  courseTitle: string,
): CourseLesson[] {
  return apiLessons.map((lesson) => ({
    id: lesson.id,
    order: lesson.lessonOrder,
    title: lesson.title,
    duration: formatDuration(lesson.durationSeconds),
    videoId: lesson.youtubeVideoId,
    tests: buildTests(lesson.title, courseTitle),
  }));
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
