import { useState, useRef, useEffect, type RefObject } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Moon, Sun, Globe, Menu, X, ChevronDown, User } from 'lucide-react';
import { NAV_PRIMARY, NAV_MENU, LANG_OPTIONS, type LangCode } from '../data/landing';
import { AuthModal } from './AuthModal';

function navClass(isActive: boolean) {
  return isActive ? 'nav-active nav-link' : 'nav-link';
}

function HeaderNavLink({
  href,
  label,
  onClick,
  isHashActive,
}: {
  href: string;
  label: string;
  onClick?: () => void;
  isHashActive?: (href: string) => boolean;
}) {
  if (href.startsWith('/#')) {
    return (
      <a
        href={href}
        className={navClass(isHashActive?.(href) ?? false)}
        onClick={onClick}
      >
        {label}
      </a>
    );
  }
  return (
    <NavLink to={href} className={({ isActive }) => navClass(isActive)} onClick={onClick}>
      {label}
    </NavLink>
  );
}

function MenuDropdown({
  open,
  onToggle,
  onClose,
  menuRef,
  isHashActive,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  isHashActive: (href: string) => boolean;
}) {
  return (
    <div className="header-menu-wrap" ref={menuRef}>
      <button
        type="button"
        className={`header-menu-btn${open ? ' header-menu-btn-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={onToggle}
      >
        Меню
        <ChevronDown className="h-4 w-4 header-menu-chevron" />
      </button>
      {open && (
        <div className="header-dropdown">
          {NAV_MENU.map((item) =>
            item.href.startsWith('/#') ? (
              <a
                key={item.label}
                href={item.href}
                className={`header-dropdown-link${isHashActive(item.href) ? ' header-dropdown-link-active' : ''}`}
                onClick={onClose}
              >
                {item.label}
              </a>
            ) : (
              <NavLink
                key={item.label}
                to={item.href}
                className={({ isActive }) =>
                  `header-dropdown-link${isActive ? ' header-dropdown-link-active' : ''}`
                }
                onClick={onClose}
              >
                {item.label}
              </NavLink>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function Header({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState<LangCode>(() => {
    const saved = localStorage.getItem('lang');
    return saved === 'ru' || saved === 'en' || saved === 'kg' ? saved : 'kg';
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const menuRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  const isHashActive = (href: string) => href.startsWith('/#') && pathname === '/';

  useEffect(() => {
    if (!menuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang === 'kg' ? 'ky' : lang;
  }, [lang]);

  const closeAll = () => {
    setMobileOpen(false);
    setMenuOpen(false);
  };

  const openAuth = (tab: 'login' | 'register' = 'login') => {
    setAuthTab(tab);
    setAuthOpen(true);
    closeAll();
  };

  const renderMenuLinks = (onClick?: () => void) =>
    NAV_MENU.map((item) => (
      <HeaderNavLink
        key={item.label}
        href={item.href}
        label={item.label}
        onClick={onClick}
        isHashActive={isHashActive}
      />
    ));

  return (
    <header className="header">
      <div className="wrap header-inner">
        <Link to="/" className="header-logo no-underline shrink-0">
          <img
            src="/logo-mualim.png"
            alt="MUALIM"
            className="h-11 w-11 object-cover rounded-full bg-white p-0.5 shadow-sm"
          />
          <span className="header-brand-name">MUALIM</span>
        </Link>

        <nav className="header-nav hidden lg:flex">
          {NAV_PRIMARY.map((item) => (
            <HeaderNavLink
              key={item.label}
              href={item.href}
              label={item.label}
              isHashActive={isHashActive}
            />
          ))}
          <MenuDropdown
            open={menuOpen}
            onToggle={() => setMenuOpen(!menuOpen)}
            onClose={() => setMenuOpen(false)}
            menuRef={menuRef}
            isHashActive={isHashActive}
          />
        </nav>

        <div className="header-actions">
          <button type="button" onClick={onToggle} className="theme-btn hidden sm:flex" aria-label="Тема">
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{dark ? 'Жарык' : 'Караңгы'}</span>
          </button>

          <div className="header-lang-wrap hidden sm:inline-flex">
            <Globe className="h-4 w-4 header-lang-icon" aria-hidden />
            <select
              className="header-lang-select"
              value={lang}
              aria-label="Тил тандоо"
              onChange={(e) => setLang(e.target.value as LangCode)}
            >
              {LANG_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="header-login-btn" onClick={() => openAuth('login')}>
            <User className="h-4 w-4" />
            Login
          </button>

          <button
            type="button"
            className="header-mobile-toggle lg:hidden"
            aria-label="Меню"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="header-mobile-nav lg:hidden wrap">
          <div className="header-mobile-group">
            {NAV_PRIMARY.map((item) => (
              <HeaderNavLink
                key={item.label}
                href={item.href}
                label={item.label}
                onClick={closeAll}
                isHashActive={isHashActive}
              />
            ))}
          </div>
          <p className="header-mobile-label">Меню</p>
          <div className="header-mobile-group">{renderMenuLinks(closeAll)}</div>
          <button type="button" className="header-login-btn header-login-btn-mobile" onClick={() => openAuth('login')}>
            <User className="h-4 w-4" />
            Login
          </button>
        </nav>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialTab={authTab} />
    </header>
  );
}
