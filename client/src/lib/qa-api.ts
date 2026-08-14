export type QuestionSort = 'default' | 'newest' | 'oldest' | 'popular';

export type QuestionArticle = {
  id: string;
  title: string;
  excerpt: string;
  views: number;
  publishedAt: string;
  type: 'text' | 'video';
  number?: number | null;
  question?: string;
  answer?: string;
  tags?: string[];
  source?: 'telegram' | 'article';
};

export type QaListResponse = {
  items: QuestionArticle[];
  total: number;
  page: number;
  totalPages: number;
};

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function fetchQaList(params: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: QuestionSort;
}): Promise<QaListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.sort) query.set('sort', params.sort);

  const res = await fetch(`${API_BASE}/api/qa?${query}`);
  if (!res.ok) throw new Error('API error');
  return res.json();
}

export async function fetchQaBySlug(slug: string): Promise<QuestionArticle> {
  const res = await fetch(`${API_BASE}/api/qa/${slug}`);
  if (!res.ok) throw new Error('Not found');
  return res.json();
}

export type AdminQaInput = {
  question: string;
  answer: string;
  number?: number;
  tags?: string[];
  type?: 'text' | 'video';
  isPublished?: boolean;
  publishedAt?: string;
};

export async function createQaArticle(token: string, data: AdminQaInput) {
  const res = await fetch(`${API_BASE}/api/qa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Create failed');
  return res.json();
}

export async function updateQaArticle(token: string, id: string, data: Partial<AdminQaInput>) {
  const res = await fetch(`${API_BASE}/api/qa/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

export async function deleteQaArticle(token: string, id: string) {
  const res = await fetch(`${API_BASE}/api/qa/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Delete failed');
}

export async function adminLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json() as Promise<{
    token: string;
    user: { id: string; email: string; role: string; firstName: string; lastName: string };
  }>;
}
