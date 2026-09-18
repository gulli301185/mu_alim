const API_BASE = import.meta.env.VITE_API_URL ?? '';

export type CourseServerProgress = {
  completedLessonIds: string[];
  isCompleted: boolean;
  enrolledAt: string | null;
};

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchCourseProgress(
  courseRef: string,
  token: string,
): Promise<CourseServerProgress> {
  const res = await fetch(`${API_BASE}/api/courses/${courseRef}/progress`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw new Error('Прогресс жүктөлбөдү');
  }
  return res.json() as Promise<CourseServerProgress>;
}

export async function completeCourseLesson(
  courseRef: string,
  lessonId: string,
  token: string,
): Promise<{ completedLessonIds: string[] }> {
  const res = await fetch(
    `${API_BASE}/api/courses/${courseRef}/progress/lessons/${lessonId}/complete`,
    {
      method: 'POST',
      headers: authHeaders(token),
    },
  );
  if (!res.ok) {
    throw new Error('Сабак белгиленген жок');
  }
  return res.json() as Promise<{ completedLessonIds: string[] }>;
}

export async function syncCourseProgress(
  courseRef: string,
  completedLessonIds: string[],
  token: string,
): Promise<{ completedLessonIds: string[] }> {
  const res = await fetch(`${API_BASE}/api/courses/${courseRef}/progress/sync`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ completedLessonIds }),
  });
  if (!res.ok) {
    throw new Error('Прогресс сакталган жок');
  }
  return res.json() as Promise<{ completedLessonIds: string[] }>;
}
