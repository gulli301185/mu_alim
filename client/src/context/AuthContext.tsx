import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminLoginRequest,
  clearAllStoredAuth,
  clearStoredAuth,
  detectStoredSessionKind,
  fetchMe,
  forgotPasswordRequest,
  loadStoredAuth,
  loginUserRequest,
  registerRequest,
  resetPasswordRequest,
  saveStoredAuth,
  updateProfileRequest,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
  type SessionKind,
  type UpdateProfileInput,
} from '../lib/auth-api';
import { authKeys } from '../lib/auth-keys';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  sessionKind: SessionKind | null;
  loading: boolean;
  isAdmin: boolean;
  isUser: boolean;
  loginUser: (input: LoginInput) => Promise<void>;
  loginAdmin: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string; resetUrl?: string }>;
  resetPassword: (input: {
    token: string;
    password: string;
    confirmPassword: string;
  }) => Promise<{ message: string }>;
  isLoggingIn: boolean;
  isRegistering: boolean;
  isLoggingOut: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isSessionValid(kind: SessionKind, user: AuthUser) {
  return kind === 'admin' ? user.role === 'admin' : user.role === 'user';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sessionKind, setSessionKind] = useState<SessionKind | null>(() => detectStoredSessionKind());
  const [token, setToken] = useState<string | null>(() => {
    const kind = detectStoredSessionKind();
    return kind ? loadStoredAuth(kind)?.token ?? null : null;
  });

  const meQuery = useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      if (!token || !sessionKind) return null;
      const user = await fetchMe(token);
      if (!isSessionValid(sessionKind, user)) {
        clearStoredAuth(sessionKind);
        throw new Error('Сессия жараксыз');
      }
      saveStoredAuth(sessionKind, { token, user });
      return user;
    },
    enabled: Boolean(token && sessionKind),
    retry: false,
  });

  const applySession = useCallback(
    (kind: SessionKind, nextToken: string, user: AuthUser) => {
      const otherKind: SessionKind = kind === 'admin' ? 'user' : 'admin';
      clearStoredAuth(otherKind);
      saveStoredAuth(kind, { token: nextToken, user });
      setSessionKind(kind);
      setToken(nextToken);
      queryClient.setQueryData(authKeys.me(), user);
    },
    [queryClient],
  );

  const clearSession = useCallback(() => {
    if (sessionKind) clearStoredAuth(sessionKind);
    clearAllStoredAuth();
    setSessionKind(null);
    setToken(null);
    queryClient.removeQueries({ queryKey: authKeys.all });
  }, [queryClient, sessionKind]);

  useEffect(() => {
    if (meQuery.isError) {
      clearSession();
    }
  }, [meQuery.isError, clearSession]);

  const loginUserMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      loginUserRequest({
        email: input.email.trim().toLowerCase(),
        password: input.password,
      }),
    onSuccess: (session) => {
      if (session.user.role !== 'user') {
        throw new Error('Колдонуучу кирүүсүн колдонуңуз');
      }
      applySession('user', session.token, session.user);
    },
  });

  const loginAdminMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      adminLoginRequest({
        email: input.email.trim().toLowerCase(),
        password: input.password,
      }),
    onSuccess: (session) => {
      if (session.user.role !== 'admin') {
        throw new Error('Админ укугу жок');
      }
      applySession('admin', session.token, session.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) =>
      registerRequest({
        ...input,
        email: input.email.trim().toLowerCase(),
      }),
    onSuccess: (session) => applySession('user', session.token, session.user),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => {
      if (!token) throw new Error('Кирүү талап кылынат');
      return updateProfileRequest(token, input);
    },
    onSuccess: (user) => {
      if (!token || !sessionKind) return;
      saveStoredAuth(sessionKind, { token, user });
      queryClient.setQueryData(authKeys.me(), user);
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (email: string) => forgotPasswordRequest(email.trim().toLowerCase()),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: resetPasswordRequest,
  });

  const logoutMutation = useMutation({
    mutationFn: async (kind: SessionKind | null) => kind,
    onSuccess: (kind) => {
      clearSession();
      if (kind === 'admin') {
        navigate('/admin/login', { replace: true });
      }
    },
  });

  const loginUser = useCallback(
    async (input: LoginInput) => {
      await loginUserMutation.mutateAsync(input);
    },
    [loginUserMutation],
  );

  const loginAdmin = useCallback(
    async (input: LoginInput) => {
      await loginAdminMutation.mutateAsync(input);
    },
    [loginAdminMutation],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await registerMutation.mutateAsync(input);
    },
    [registerMutation],
  );

  const logout = useCallback(() => {
    logoutMutation.mutate(sessionKind);
  }, [logoutMutation, sessionKind]);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      await updateProfileMutation.mutateAsync(input);
    },
    [updateProfileMutation],
  );

  const forgotPassword = useCallback(
    async (email: string) => forgotPasswordMutation.mutateAsync(email),
    [forgotPasswordMutation],
  );

  const resetPassword = useCallback(
    async (input: { token: string; password: string; confirmPassword: string }) =>
      resetPasswordMutation.mutateAsync(input),
    [resetPasswordMutation],
  );

  const storedUser =
    sessionKind && token ? loadStoredAuth(sessionKind)?.user ?? null : null;
  const user = meQuery.data ?? storedUser;
  const loading = Boolean(token && sessionKind) && meQuery.isPending;
  const isAdmin = sessionKind === 'admin' && user?.role === 'admin';
  const isUser = sessionKind === 'user' && user?.role === 'user';

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      sessionKind,
      loading,
      isAdmin,
      isUser,
      loginUser,
      loginAdmin,
      register,
      logout,
      updateProfile,
      forgotPassword,
      resetPassword,
      isLoggingIn: loginUserMutation.isPending || loginAdminMutation.isPending,
      isRegistering: registerMutation.isPending,
      isLoggingOut: logoutMutation.isPending,
    }),
    [
      user,
      token,
      sessionKind,
      loading,
      isAdmin,
      isUser,
      loginUser,
      loginAdmin,
      register,
      logout,
      updateProfile,
      forgotPassword,
      resetPassword,
      loginUserMutation.isPending,
      loginAdminMutation.isPending,
      registerMutation.isPending,
      logoutMutation.isPending,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
