import { parseApiErrorResponse } from './api-errors';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export type CourseServerProgress = {
  completedLessonIds: string[];
  isCompleted: boolean;
  enrolledAt: string | null;
  finalTestPassed?: boolean;
  finalTestScore?: number | null;
  certificate?: {
    id: string;
    certificateNumber: string;
    verificationCode: string;
    recipientName: string | null;
    issuedAt: string;
  } | null;
};

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

/** An ApiError keeps the status, the server's `code` and Retry-After, so the page can tell
 * 400 (previous lesson not confirmed) / 429 (too many completions) from other failures. */
function parseProgressError(res: Response, fallback: string) {
  return parseApiErrorResponse(res, fallback);
}

export async function fetchCourseProgress(
  courseRef: string,
  token: string,
): Promise<CourseServerProgress> {
  const res = await fetch(`${API_BASE}/api/courses/${courseRef}/progress`, {
    headers: authHeaders(token),
  });
  if (!res.ok) {
    throw await parseProgressError(res, 'Прогресс жүктөлбөдү');
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
    throw await parseProgressError(res, 'Сабак белгиленген жок');
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
    throw await parseProgressError(res, 'Прогресс сакталган жок');
  }
  return res.json() as Promise<{ completedLessonIds: string[] }>;
}

export type IssuedCertificate = {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  recipientName: string | null;
  issuedAt: string;
  courseId: string;
  courseTitle: string | null;
};

export async function issueCourseCertificate(
  courseRef: string,
  token: string,
  input: { studentName: string; certificateNumber?: string },
): Promise<IssuedCertificate> {
  const res = await fetch(`${API_BASE}/api/courses/${courseRef}/progress/certificate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw await parseProgressError(res, 'Сертификат сакталган жок');
  }
  return res.json() as Promise<IssuedCertificate>;
}
