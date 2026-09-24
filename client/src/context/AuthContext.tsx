import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminLoginRequest,
  clearAllStoredAuth,
  clearStoredAuth,
  detectStoredSessionKind,
  fetchMe,
  confirmCodeRequest,
  forgotPasswordRequest,
  isRegisterPending,
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
import { enrollmentKeys } from '../hooks/useMyEnrollments';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  sessionKind: SessionKind | null;
  loading: boolean;
  isAdmin: boolean;
  isUser: boolean;
  loginUser: (input: LoginInput) => Promise<void>;
  loginAdmin: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<{ needsConfirmation: true; email: string; message: string } | void>;
  confirmCode: (input: { email: string; code: string }) => Promise<void>;
  logout: () => void;
  updateProfile: (input: UpdateProfileInput) => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  forgotPassword: (input: { email: string }) => Promise<{ message: string }>;
  resetPassword: (input: {
    token: string;
    email: string;
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
    queryKey: authKeys.me(token),
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
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const applySession = useCallback(
    (kind: SessionKind, nextToken: string, user: AuthUser) => {
      const otherKind: SessionKind = kind === 'admin' ? 'user' : 'admin';
      clearStoredAuth(otherKind);
      clearAllStoredAuth();
      saveStoredAuth(kind, { token: nextToken, user });
      setSessionKind(kind);
      setToken(nextToken);
      queryClient.removeQueries({ queryKey: authKeys.all });
      queryClient.setQueryData(authKeys.me(nextToken), user);
      if (kind === 'user') {
        void queryClient.invalidateQueries({ queryKey: enrollmentKeys.all });
        queryClient.removeQueries({ queryKey: ['course-progress'] });
        queryClient.removeQueries({ queryKey: ['course-lessons'] });
      }
    },
    [queryClient],
  );

  const clearSession = useCallback(() => {
    if (sessionKind) clearStoredAuth(sessionKind);
    clearAllStoredAuth();
    setSessionKind(null);
    setToken(null);
    queryClient.removeQueries({ queryKey: authKeys.all });
    queryClient.removeQueries({ queryKey: enrollmentKeys.all });
    queryClient.removeQueries({ queryKey: ['course-progress'] });
    queryClient.removeQueries({ queryKey: ['course-lessons'] });
    queryClient.removeQueries({ queryKey: ['course-final-test'] });
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
    onSuccess: (result) => {
      if (isRegisterPending(result)) return;
      applySession('user', result.token, result.user);
      navigate('/', { replace: true });
    },
  });

  const confirmCodeMutation = useMutation({
    mutationFn: confirmCodeRequest,
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
      queryClient.setQueryData(authKeys.me(token), user);
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: (input: { email: string }) => forgotPasswordRequest(input),
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
      } else {
        navigate('/', { replace: true });
      }
    },
  });

  const loginUser = useCallback(
    async (input: LoginInput) => {
      await loginUserMutation.mutateAsync(input);
      navigate('/', { replace: true });
    },
    [loginUserMutation, navigate],
  );

  const loginAdmin = useCallback(
    async (input: LoginInput) => {
      await loginAdminMutation.mutateAsync(input);
    },
    [loginAdminMutation],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const result = await registerMutation.mutateAsync(input);
      if (isRegisterPending(result)) {
        return { needsConfirmation: true as const, email: result.email, message: result.message };
      }
    },
    [registerMutation],
  );

  const confirmCode = useCallback(
    async (input: { email: string; code: string }) => {
      await confirmCodeMutation.mutateAsync(input);
      navigate('/', { replace: true });
    },
    [confirmCodeMutation, navigate],
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

  const refreshUser = useCallback(async () => {
    if (!token || !sessionKind) return null;
    const next = await queryClient.fetchQuery({
      queryKey: authKeys.me(token),
      queryFn: async () => {
        const me = await fetchMe(token);
        if (!isSessionValid(sessionKind, me)) {
          clearStoredAuth(sessionKind);
          throw new Error('Сессия жараксыз');
        }
        saveStoredAuth(sessionKind, { token, user: me });
        return me;
      },
    });
    return next;
  }, [token, sessionKind, queryClient]);

  const forgotPassword = useCallback(
    async (input: { email: string }) => forgotPasswordMutation.mutateAsync(input),
    [forgotPasswordMutation],
  );

  const resetPassword = useCallback(
    async (input: {
      token: string;
      email: string;
      password: string;
      confirmPassword: string;
    }) => resetPasswordMutation.mutateAsync(input),
    [resetPasswordMutation],
  );

  const storedUser =
    sessionKind && token ? loadStoredAuth(sessionKind)?.user ?? null : null;
  // Prefer live backend `/me` data; localStorage is only a brief placeholder while loading.
  const user = meQuery.data ?? storedUser;
  const loading = Boolean(token && sessionKind) && meQuery.isPending && !meQuery.data;
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
      confirmCode,
      logout,
      updateProfile,
      refreshUser,
      forgotPassword,
      resetPassword,
      isLoggingIn: loginUserMutation.isPending || loginAdminMutation.isPending,
      isRegistering: registerMutation.isPending || confirmCodeMutation.isPending,
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
      confirmCode,
      logout,
      updateProfile,
      refreshUser,
      forgotPassword,
      resetPassword,
      loginUserMutation.isPending,
      loginAdminMutation.isPending,
      registerMutation.isPending,
      confirmCodeMutation.isPending,
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
