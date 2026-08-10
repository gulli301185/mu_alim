import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <div className={dark ? 'dark' : ''}>
      <Header dark={dark} onToggle={() => setDark(!dark)} />
      <Outlet />
      <Footer />
    </div>
  );
}
