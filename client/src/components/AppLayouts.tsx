import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { useAuth } from '../context/AuthContext';

function AuthLoading() {
  return (
    <section className="profile-page">
      <div className="wrap profile-page-wrap">
        <div className="ui-card profile-card">
          <p>Жүктөлүүдө...</p>
        </div>
      </div>
    </section>
  );
}

function getInitialDark(): boolean {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function PublicThemeShell() {
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className={dark ? 'dark' : ''}>
      <Header dark={dark} onToggle={() => setDark(!dark)} />
      <Outlet />
      <Footer />
    </div>
  );
}

export function PublicLayout() {
  const { loading, isAdmin } = useAuth();

  if (loading) return <AuthLoading />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  return <PublicThemeShell />;
}

export function AdminLoginLayout() {
  const { loading, sessionKind, user } = useAuth();
  const [dark] = useState(getInitialDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  if (loading) return <AuthLoading />;
  if (sessionKind === 'user' && user) return <Navigate to="/" replace />;

  return (
    <div className={dark ? 'dark' : ''}>
      <Outlet />
    </div>
  );
}
