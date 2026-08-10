import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Search, Moon, Sun, Globe, Menu, X } from 'lucide-react';
import { NAV, SITE } from '../data/landing';

function navClass(isActive: boolean) {
  return isActive ? 'nav-active nav-link' : 'nav-link';
}
// nnj
function NavItem({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  if (href.startsWith('/#')) {
    return <a href={href} className="nav-link py-1.5 xl:py-0" onClick={onClick}>{label}</a>;
  }
  return (
    <NavLink to={href} className={({ isActive }) => `${navClass(isActive)} py-1.5 xl:py-0`} onClick={onClick}>
      {label}
    </NavLink>
  );
}

export function Header({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const isHashActive = (href: string) => href.startsWith('/#') && pathname === '/';

  return (
    <header className="header">
      <div className="wrap flex items-center justify-between h-[68px] gap-4">
        <Link to="/" className="flex items-center gap-3 no-underline shrink-0">
          <img src="/logo-mualim.png" alt="Logo" className="h-11 w-11 object-contain" />
          <div>
            <p className="text-sm font-extrabold text-navy leading-tight tracking-wide">{SITE.name}</p>
            <p className="text-[10px] text-muted font-medium">{SITE.tagline}</p>
          </div>
        </Link>

        <nav className="hidden xl:flex items-center gap-5">
          {NAV.map((l) => (
            l.href.startsWith('/#') ? (
              <a key={l.label} href={l.href} className={navClass(isHashActive(l.href))}>{l.label}</a>
            ) : (
              <NavLink key={l.label} to={l.href} className={({ isActive }) => navClass(isActive)}>
                {l.label}
              </NavLink>
            )
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button className="p-2 text-navy hover:text-gold" aria-label="Издөө"><Search className="h-4 w-4" /></button>
          <button onClick={onToggle} className="theme-btn" aria-label="Тема">
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{dark ? 'Light' : 'Dark'}</span>
          </button>
          <button className="hidden sm:flex items-center gap-1 text-sm font-medium text-navy">
            <Globe className="h-4 w-4" /> KG
          </button>
          <button className="xl:hidden p-2" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="xl:hidden wrap pb-4 flex flex-col gap-2 border-t pt-3">
          {NAV.map((l) => (
            <NavItem key={l.label} href={l.href} label={l.label} onClick={() => setOpen(false)} />
          ))}
        </nav>
      )}
    </header>
  );
}
