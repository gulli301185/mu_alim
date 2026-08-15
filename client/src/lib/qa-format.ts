import type { QuestionSort } from './qa-api';

export type { QuestionArticle, QuestionSort } from './qa-api';

export const QUESTIONS_PER_PAGE = 10;

export const QUESTION_SORT_OPTIONS: { value: QuestionSort; label: string }[] = [
  { value: 'default', label: '№ боюнча (1, 2, 3…)' },
  { value: 'newest', label: 'Алгач жаңылары' },
  { value: 'oldest', label: 'Алгач эскилери' },
  { value: 'popular', label: 'Алгач популярдуулары' },
];

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
