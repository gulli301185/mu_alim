const API_BASE = import.meta.env.VITE_API_URL ?? '';

export type MyEnrollment = {
  id: string;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  enrolledAt: string;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  courseType: 'free' | 'paid';
};

export type MyEnrollmentsResponse = {
  items: MyEnrollment[];
};

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

export async function fetchMyEnrollments(token: string): Promise<MyEnrollmentsResponse> {
  const res = await fetch(`${API_BASE}/api/me/enrollments`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseApiError(res, 'Катталуулар жүктөлбөдү');
  return res.json() as Promise<MyEnrollmentsResponse>;
}

export type CourseRef = {
  id?: string;
  slug?: string;
  recordId?: string;
};

export function isEnrolledInCourse(
  enrollments: MyEnrollment[],
  courseRef: CourseRef,
): boolean {
  const refs = new Set(
    [courseRef.id, courseRef.slug, courseRef.recordId].filter(
      (value): value is string => Boolean(value),
    ),
  );
  return enrollments.some(
    (item) =>
      (item.status === 'active' || item.status === 'completed') &&
      (refs.has(item.courseSlug) || refs.has(item.courseId)),
  );
}
