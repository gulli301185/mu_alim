import type { CourseSummary, CourseType } from './course-api';
import type { CreateLessonInput, LessonDto } from './lesson-api';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export type AdminCourseItem = CourseSummary & {
  isPublished: boolean;
  lessonsCount: number;
  enrollmentsCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminCoursesListResponse = {
  items: AdminCourseItem[];
  total: number;
  page: number;
  totalPages: number;
};

export type CreateCourseInput = {
  title: string;
  slug?: string;
  description: string;
  shortDescription?: string;
  courseType: CourseType;
  price?: number;
  currency?: string;
  level?: string;
  isPublished?: boolean;
  isPopular?: boolean;
};

export type UpdateCourseInput = Partial<CreateCourseInput>;

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseApiError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string };
    return new Error(data.error ?? fallback);
  } catch {
    return new Error(fallback);
  }
}

export async function fetchAdminCourses(
  token: string,
  params?: { type?: CourseType; page?: number; limit?: number },
): Promise<AdminCoursesListResponse> {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/api/admin/courses?${query.toString()}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseApiError(res, 'Курстарды жүктөө ийгиликсиз');
  return res.json() as Promise<AdminCoursesListResponse>;
}

export async function createAdminCourse(token: string, input: CreateCourseInput) {
  const res = await fetch(`${API_BASE}/api/admin/courses`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseApiError(res, 'Курс түзүлбөдү');
  const data = (await res.json()) as { course: AdminCourseItem };
  return data.course;
}

export async function fetchAdminCourse(token: string, courseRef: string): Promise<AdminCourseItem> {
  const res = await fetch(`${API_BASE}/api/admin/courses/${encodeURIComponent(courseRef)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseApiError(res, 'Курс жүктөлбөдү');
  const data = (await res.json()) as { course: AdminCourseItem };
  return data.course;
}

export async function updateAdminCourse(
  token: string,
  courseRef: string,
  input: UpdateCourseInput,
) {
  const res = await fetch(`${API_BASE}/api/admin/courses/${encodeURIComponent(courseRef)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseApiError(res, 'Курс жаңыртылган жок');
  const data = (await res.json()) as { course: AdminCourseItem };
  return data.course;
}

export async function deleteAdminCourse(token: string, courseRef: string) {
  const res = await fetch(`${API_BASE}/api/admin/courses/${encodeURIComponent(courseRef)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseApiError(res, 'Курс өчүрүлбөдү');
}

export async function fetchAdminCourseLessons(token: string, courseRef: string): Promise<LessonDto[]> {
  const res = await fetch(
    `${API_BASE}/api/admin/courses/${encodeURIComponent(courseRef)}/lessons`,
    { headers: authHeaders(token) },
  );
  if (!res.ok) throw await parseApiError(res, 'Сабактар жүктөлбөдү');
  return res.json() as Promise<LessonDto[]>;
}

export async function createAdminLesson(
  token: string,
  courseRef: string,
  input: CreateLessonInput,
) {
  const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(courseRef)}/lessons`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseApiError(res, 'Сабак түзүлбөдү');
  return res.json() as Promise<LessonDto>;
}

export { type CreateLessonInput, type LessonDto };
