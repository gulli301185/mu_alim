import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { useAuth } from '../context/AuthContext';

function getInitialDark(): boolean {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function Layout() {
  const [dark, setDark] = useState(getInitialDark);
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const adminQaMode = isAdmin && pathname.startsWith('/questions');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className={dark ? 'dark' : ''}>
      <Header dark={dark} onToggle={() => setDark(!dark)} adminSimple={adminQaMode} />
      <Outlet />
      {!adminQaMode ? <Footer /> : null}
    </div>
  );
}
