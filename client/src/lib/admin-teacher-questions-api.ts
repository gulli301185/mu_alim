import { API_BASE } from './asset-url';

export type TeacherQuestionStatus = 'pending' | 'answered';

export type AdminTeacherQuestion = {
  id: string;
  questionNumber: number | null;
  name: string;
  question: string;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
  qaSlug: string | null;
  status: TeacherQuestionStatus;
};

export type AdminTeacherQuestionsResponse = {
  items: AdminTeacherQuestion[];
  total: number;
  page: number;
  totalPages: number;
};

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error || fallback;
}

export async function fetchAdminTeacherQuestions(
  token: string,
  options?: {
    status?: 'pending' | 'answered' | 'all';
    page?: number;
    limit?: number;
    q?: string;
  },
): Promise<AdminTeacherQuestionsResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.q) params.set('q', options.q);

  const res = await fetch(`${API_BASE}/api/admin/teacher-questions?${params}`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    throw new Error(await readError(res, 'Жүктөө ийгиликсиз'));
  }

  return res.json() as Promise<AdminTeacherQuestionsResponse>;
}

export async function publishTeacherQuestionAnswer(
  token: string,
  id: string,
  answer: string,
): Promise<{ slug: string; questionNumber: number | null; message: string }> {
  const res = await fetch(`${API_BASE}/api/admin/teacher-questions/${id}/publish`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ answer }),
  });

  if (!res.ok) {
    throw new Error(await readError(res, 'Жариялоо ийгиликсиз'));
  }

  return res.json() as Promise<{ slug: string; questionNumber: number | null; message: string }>;
}
