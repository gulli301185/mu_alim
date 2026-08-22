const API_BASE = import.meta.env.VITE_API_URL ?? '';
const USER_AUTH_STORAGE_KEY = 'mualim_user_auth';
const ADMIN_AUTH_STORAGE_KEY = 'mualim_admin_auth';
const LEGACY_AUTH_STORAGE_KEY = 'mualim_auth';

export type SessionKind = 'user' | 'admin';

function storageKeyFor(kind: SessionKind) {
  return kind === 'admin' ? ADMIN_AUTH_STORAGE_KEY : USER_AUTH_STORAGE_KEY;
}

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

async function authFetch(url: string, init: RequestInit, _fallback: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new AuthApiError('Сервер иштебейт. API иштеп жатканын текшериңиз.');
  }
}

function parseStoredSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadStoredAuth(kind: SessionKind): AuthSession | null {
  const session = parseStoredSession(localStorage.getItem(storageKeyFor(kind)));
  if (session) return session;

  const legacy = parseStoredSession(localStorage.getItem(LEGACY_AUTH_STORAGE_KEY));
  if (!legacy) return null;

  const legacyKind: SessionKind = legacy.user.role === 'admin' ? 'admin' : 'user';
  if (legacyKind !== kind) return null;

  saveStoredAuth(kind, legacy);
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  return legacy;
}

export function saveStoredAuth(kind: SessionKind, session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(storageKeyFor(kind));
    return;
  }
  localStorage.setItem(storageKeyFor(kind), JSON.stringify(session));
}

export function clearStoredAuth(kind: SessionKind) {
  localStorage.removeItem(storageKeyFor(kind));
}

export function clearAllStoredAuth() {
  localStorage.removeItem(USER_AUTH_STORAGE_KEY);
  localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
}

export function detectStoredSessionKind(): SessionKind | null {
  const admin = loadStoredAuth('admin');
  if (admin) return 'admin';
  const user = loadStoredAuth('user');
  if (user) return 'user';
  return null;
}

export async function loginUserRequest(input: LoginInput): Promise<AuthSession> {
  const res = await authFetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }, 'Кирүү ийгиликсиз');
  if (!res.ok) throw await parseApiError(res, 'Кирүү ийгиликсиз');
  return res.json() as Promise<AuthSession>;
}

export async function adminLoginRequest(input: LoginInput): Promise<AuthSession> {
  const res = await authFetch(`${API_BASE}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }, 'Кирүү ийгиликсиз');
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

export async function forgotPasswordRequest(email: string): Promise<{ message: string; code?: string }> {
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw await parseApiError(res, 'Сурам ийгиликсиз');
  return res.json() as Promise<{ message: string; code?: string }>;
}

export async function resetPasswordRequest(input: {
  token: string;
  email?: string;
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
