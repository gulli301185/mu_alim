import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { UserAuthModal } from '../components/UserAuthModal';
import { useAuth } from './AuthContext';

type AuthTab = 'login' | 'register';

type AuthModalContextValue = {
  openAuth: (tab?: AuthTab) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AuthTab>('login');

  const openAuth = useCallback(
    (initialTab: AuthTab = 'login') => {
      if (isAdmin) return;
      setTab(initialTab);
      setOpen(true);
    },
    [isAdmin],
  );

  return (
    <AuthModalContext.Provider value={{ openAuth }}>
      {children}
      {!isAdmin ? (
        <UserAuthModal open={open} onClose={() => setOpen(false)} initialTab={tab} />
      ) : null}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error('useAuthModal must be used within AuthModalProvider');
  }
  return ctx;
}
