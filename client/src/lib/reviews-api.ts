const API_BASE = import.meta.env.VITE_API_URL ?? '';

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type CourseReview = {
  id: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  courseTitle?: string;
  courseSlug?: string;
  authorEmail?: string;
};

export type CourseReviewsResponse = {
  items: CourseReview[];
  total: number;
  page: number;
  totalPages: number;
  averageRating: number;
  ratingsCount: number;
  mine: CourseReview | null;
};

export type AdminReviewsResponse = {
  items: CourseReview[];
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

export type PublicReviewsResponse = {
  items: CourseReview[];
  total: number;
  page: number;
  totalPages: number;
};

export async function fetchPublicReviews(options?: {
  page?: number;
  limit?: number;
}): Promise<PublicReviewsResponse> {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  const res = await fetch(`${API_BASE}/api/reviews${query ? `?${query}` : ''}`);
  if (!res.ok) throw new Error(await readError(res, 'Пикирлер жүктөлгөн жок'));
  return res.json() as Promise<PublicReviewsResponse>;
}

export async function createAdminReview(
  token: string,
  input: {
    courseRef: string;
    rating: number;
    comment: string;
    displayName: string;
  },
): Promise<{ review: CourseReview }> {
  const res = await fetch(`${API_BASE}/api/admin/reviews`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, 'Пикир кошулган жок'));
  return res.json() as Promise<{ review: CourseReview }>;
}

export async function fetchCourseReviews(
  courseRef: string,
  options?: { page?: number; limit?: number; token?: string | null },
): Promise<CourseReviewsResponse> {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  const res = await fetch(
    `${API_BASE}/api/courses/${encodeURIComponent(courseRef)}/reviews${query ? `?${query}` : ''}`,
    {
      headers: options?.token ? { Authorization: `Bearer ${options.token}` } : undefined,
    },
  );
  if (!res.ok) throw new Error(await readError(res, 'Пикирлер жүктөлгөн жок'));
  return res.json() as Promise<CourseReviewsResponse>;
}

export async function submitCourseReview(
  token: string,
  courseRef: string,
  input: { rating: number; comment?: string; displayName?: string },
): Promise<{ review: CourseReview; message: string }> {
  const res = await fetch(`${API_BASE}/api/courses/${encodeURIComponent(courseRef)}/reviews`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res, 'Пикир сакталган жок'));
  return res.json() as Promise<{ review: CourseReview; message: string }>;
}

export async function fetchAdminReviews(
  token: string,
  options?: { status?: ReviewStatus; page?: number; limit?: number; q?: string },
): Promise<AdminReviewsResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.q) params.set('q', options.q);
  const query = params.toString();
  const res = await fetch(`${API_BASE}/api/admin/reviews${query ? `?${query}` : ''}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, 'Пикирлер жүктөлгөн жок'));
  return res.json() as Promise<AdminReviewsResponse>;
}

export async function moderateReview(token: string, id: string, status: ReviewStatus) {
  const res = await fetch(`${API_BASE}/api/admin/reviews/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Статус өзгөргөн жок'));
  return res.json() as Promise<{ review: CourseReview }>;
}

export async function deleteReview(token: string, id: string) {
  const res = await fetch(`${API_BASE}/api/admin/reviews/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, 'Өчүрүлгөн жок'));
}
