const API_BASE = import.meta.env.VITE_API_URL ?? '';
const AUTH_STORAGE_KEY = 'mualim_auth';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'user' | 'admin';
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
};

export type UpdateProfileInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  currentPassword?: string;
  newPassword?: string;
};

export class AuthApiError extends Error {
  fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'AuthApiError';
    this.fields = fields;
  }
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseApiError(res: Response, fallback: string): Promise<AuthApiError> {
  try {
    const data = (await res.json()) as { error?: string; fields?: Record<string, string> };
    return new AuthApiError(data.error ?? fallback, data.fields);
  } catch {
    return new AuthApiError(fallback);
  }
}

export function loadStoredAuth(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredAuth(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export async function loginUserRequest(input: LoginInput): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseApiError(res, 'Кирүү ийгиликсиз');
  return res.json() as Promise<AuthSession>;
}

export async function adminLoginRequest(input: LoginInput): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseApiError(res, 'Кирүү ийгиликсиз');
  return res.json() as Promise<AuthSession>;
}

export async function registerRequest(input: RegisterInput): Promise<AuthSession> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseApiError(res, 'Каттоо ийгиликсиз');
  return res.json() as Promise<AuthSession>;
}

export async function forgotPasswordRequest(email: string): Promise<{ message: string; resetUrl?: string }> {
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw await parseApiError(res, 'Сурам ийгиликсиз');
  return res.json() as Promise<{ message: string; resetUrl?: string }>;
}

export async function resetPasswordRequest(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseApiError(res, 'Сыр сөздү өзгөртүү ийгиликсиз');
  return res.json() as Promise<{ message: string }>;
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await parseApiError(res, 'Сессия жараксыз');
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function updateProfileRequest(
  token: string,
  input: UpdateProfileInput,
): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await parseApiError(res, 'Жаңыртуу ийгиликсиз');
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export function getUserDisplayName(user: AuthUser) {
  return `${user.firstName} ${user.lastName}`.trim() || user.email;
}
