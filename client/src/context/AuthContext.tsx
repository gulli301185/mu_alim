import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchMe,
  loadStoredAuth,
  loginRequest,
  registerRequest,
  saveStoredAuth,
  updateProfileRequest,
  type AuthSession,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from '../lib/auth-api';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => loadStoredAuth());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const stored = loadStoredAuth();
      if (!stored?.token) {
        if (!cancelled) {
          setSession(null);
          setLoading(false);
        }
        return;
      }

      try {
        const user = await fetchMe(stored.token);
        if (cancelled) return;
        const next = { token: stored.token, user };
        setSession(next);
        saveStoredAuth(next);
      } catch {
        if (cancelled) return;
        saveStoredAuth(null);
        setSession(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: AuthSession | null) => {
    setSession(next);
    saveStoredAuth(next);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const next = await loginRequest({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });
    persist(next);
  }, [persist]);

  const register = useCallback(async (input: RegisterInput) => {
    const next = await registerRequest({
      ...input,
      email: input.email.trim().toLowerCase(),
    });
    persist(next);
  }, [persist]);

  const logout = useCallback(() => {
    persist(null);
  }, [persist]);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (!session?.token) throw new Error('Кирүү талап кылынат');
      const user = await updateProfileRequest(session.token, input);
      persist({ token: session.token, user });
    },
    [persist, session?.token],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      loading,
      isAdmin: session?.user?.role === 'admin',
      login,
      register,
      logout,
      updateProfile,
    }),
    [session, loading, login, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
