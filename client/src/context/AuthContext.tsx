import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adminLoginRequest,
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
  type UpdateProfileInput,
} from '../lib/auth-api';
import { authKeys } from '../lib/auth-keys';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => loadStoredAuth()?.token ?? null);

  const meQuery = useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      if (!token) return null;
      const user = await fetchMe(token);
      saveStoredAuth({ token, user });
      return user;
    },
    enabled: Boolean(token),
  });

  const applySession = useCallback(
    (nextToken: string, user: AuthUser) => {
      saveStoredAuth({ token: nextToken, user });
      setToken(nextToken);
      queryClient.setQueryData(authKeys.me(), user);
    },
    [queryClient],
  );

  const clearSession = useCallback(() => {
    saveStoredAuth(null);
    setToken(null);
    queryClient.removeQueries({ queryKey: authKeys.all });
  }, [queryClient]);

  const loginUserMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      loginUserRequest({
        email: input.email.trim().toLowerCase(),
        password: input.password,
      }),
    onSuccess: (session) => applySession(session.token, session.user),
  });

  const loginAdminMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      adminLoginRequest({
        email: input.email.trim().toLowerCase(),
        password: input.password,
      }),
    onSuccess: (session) => applySession(session.token, session.user),
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) =>
      registerRequest({
        ...input,
        email: input.email.trim().toLowerCase(),
      }),
    onSuccess: (session) => applySession(session.token, session.user),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => {
      if (!token) throw new Error('Кирүү талап кылынат');
      return updateProfileRequest(token, input);
    },
    onSuccess: (user) => {
      if (!token) return;
      saveStoredAuth({ token, user });
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
    mutationFn: async () => undefined,
    onSuccess: () => clearSession(),
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
    logoutMutation.mutate();
  }, [logoutMutation]);

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

  const user = meQuery.data ?? (token ? loadStoredAuth()?.user ?? null : null);
  const loading = Boolean(token) && meQuery.isPending;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      isAdmin: user?.role === 'admin',
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
      loading,
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
