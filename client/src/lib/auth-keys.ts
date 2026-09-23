export const authKeys = {
  all: ['auth'] as const,
  me: (token?: string | null) => [...authKeys.all, 'me', token ?? ''] as const,
};
