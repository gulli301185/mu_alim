export type CourseType = 'free' | 'paid';

export type CourseSummary = {
  id: string;
  recordId: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string;
  coverImage: string | null;
  courseType: CourseType;
  price: number;
  currency: string;
  priceLabel: string;
  level: string | null;
  isPopular: boolean;
  lessonCount: number;
  introVideoId: string | null;
  introDurationSeconds: number | null;
};

export type CourseListResponse = {
  items: CourseSummary[];
  total: number;
  page: number;
  totalPages: number;
};

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function formatCourseDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export type FreeLessonItem = {
  id: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
  youtubeVideoId: string;
  durationSeconds: number | null;
  lessonOrder: number;
  courseSlug: string;
  courseTitle: string;
};

export async function fetchFreeLessons(): Promise<{ items: FreeLessonItem[]; total: number }> {
  const res = await fetch(`${API_BASE}/api/free-lessons`);
  if (!res.ok) throw new Error('Бекер видеолор жүктөлбөдү');
  return res.json() as Promise<{ items: FreeLessonItem[]; total: number }>;
}

export async function fetchCourses(params?: {
  type?: CourseType;
  page?: number;
  limit?: number;
}): Promise<CourseListResponse> {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/api/courses?${query.toString()}`);
  if (!res.ok) throw new Error('Курстар жүктөлбөдү');
  return res.json() as Promise<CourseListResponse>;
}

export async function fetchCourseByRef(courseRef: string): Promise<CourseSummary> {
  const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(courseRef)}`);
  if (res.status === 404) throw new Error('Курс табылган жок');
  if (!res.ok) throw new Error('Курс жүктөлбөдү');
  const data = (await res.json()) as { course: CourseSummary };
  return data.course;
}

export function isFreeCourse(course: Pick<CourseSummary, 'courseType'>) {
  return course.courseType === 'free';
}

export const FREE_COURSE_LEARN_PATH = '/courses/free-bayanlar/learn';

export function courseTypeLabel(type: CourseType) {
  return type === 'free' ? 'Бекер' : 'Акы төлөнүүчү';
}
