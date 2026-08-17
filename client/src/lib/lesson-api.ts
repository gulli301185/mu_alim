export type LessonDto = {
  id: string;
  title: string;
  description?: string | null;
  youtubeVideoId: string;
  durationSeconds?: number | null;
  lessonOrder: number;
  isPublished: boolean;
};

export type CreateLessonInput = {
  title: string;
  description?: string;
  youtubeUrl: string;
  durationSeconds?: number;
  lessonOrder: number;
  isPublished?: boolean;
};

export type UpdateLessonInput = Partial<CreateLessonInput>;

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function parseApiError(res: Response, fallback: string) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getLessonsByCourse(courseId: string): Promise<LessonDto[]> {
  const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(courseId)}/lessons`);
  if (res.status === 404) throw new Error('Курс табылган жок');
  if (!res.ok) throw new Error(await parseApiError(res, 'Сабактар жүктөлбөдү'));
  return res.json();
}

export async function createLesson(token: string, courseId: string, data: CreateLessonInput) {
  const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(courseId)}/lessons`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseApiError(res, 'Сабак түзүлбөдү'));
  return res.json() as Promise<LessonDto>;
}

export async function updateLesson(token: string, id: string, data: UpdateLessonInput) {
  const res = await fetch(`${API_BASE}/api/lessons/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseApiError(res, 'Сабак жаңыртылган жок'));
  return res.json() as Promise<LessonDto>;
}

export async function deleteLesson(token: string, id: string) {
  const res = await fetch(`${API_BASE}/api/lessons/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await parseApiError(res, 'Сабак өчүрүлбөдү'));
}
