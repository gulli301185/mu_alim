const API_BASE = import.meta.env.VITE_API_URL ?? '';

export type AdminUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'user' | 'admin';
  isActive: boolean;
  isVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type AdminUserListItem = AdminUser & {
  enrollmentsCount: number;
  certificatesCount: number;
  activeCoursesCount: number;
};

export type AdminUserCourse = {
  id: string;
  title: string;
  slug: string;
  courseType: 'free' | 'paid';
  price: number;
  currency: string;
};

export type AdminUserEnrollment = {
  id: string;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  enrolledAt: string;
  completedAt: string | null;
  course: AdminUserCourse;
};

export type AdminUserCourseProgress = {
  id: string;
  progressPercent: number;
  isCompleted: boolean;
  completedAt: string | null;
  updatedAt: string;
  course: AdminUserCourse;
  lastLesson: {
    id: string;
    title: string;
    lessonOrder: number;
  } | null;
};

export type AdminUserCertificate = {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  issuedAt: string;
  course: AdminUserCourse;
};

export type AdminUsersListResponse = {
  items: AdminUserListItem[];
  total: number;
  page: number;
  totalPages: number;
};

export type AdminUserDetailResponse = {
  user: AdminUser;
  enrollments: AdminUserEnrollment[];
  courseProgress: AdminUserCourseProgress[];
  certificates: AdminUserCertificate[];
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

export async function fetchAdminUsers(
  token: string,
  params: { page?: number; limit?: number; search?: string },
): Promise<AdminUsersListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search?.trim()) query.set('search', params.search.trim());

  const res = await fetch(`${API_BASE}/api/admin/users?${query.toString()}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseApiError(res, 'Колдонуучуларды жүктөө ийгиликсиз');
  return res.json() as Promise<AdminUsersListResponse>;
}

export async function fetchAdminUserDetail(
  token: string,
  userId: string,
): Promise<AdminUserDetailResponse> {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseApiError(res, 'Колдонуучуну жүктөө ийгиликсиз');
  return res.json() as Promise<AdminUserDetailResponse>;
}

export async function updateAdminUserStatus(
  token: string,
  userId: string,
  isActive: boolean,
): Promise<AdminUser> {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) throw await parseApiError(res, 'Статус өзгөртүү ийгиликсиз');
  const data = (await res.json()) as { user: AdminUser };
  return data.user;
}

export function getAdminUserDisplayName(user: Pick<AdminUser, 'firstName' | 'lastName' | 'email'>) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}

export function formatAdminDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ky-KG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function enrollmentStatusLabel(status: AdminUserEnrollment['status']) {
  switch (status) {
    case 'active':
      return 'Активдүү';
    case 'completed':
      return 'Аякталган';
    case 'cancelled':
      return 'Жокко чыгарылган';
    case 'expired':
      return 'Мөөнөтү өткөн';
    default:
      return status;
  }
}

export function courseTypeLabel(type: AdminUserCourse['courseType']) {
  return type === 'paid' ? 'Акы төлөнүүчү' : 'Бекер';
}
