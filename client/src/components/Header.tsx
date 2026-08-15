import { useState, useRef, useEffect, type RefObject } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Moon, Sun, Globe, Menu, X, ChevronDown, User, LogOut, Shield } from 'lucide-react';
import { NAV_PRIMARY, NAV_MENU, LANG_OPTIONS, type LangCode } from '../data/landing';
import { AuthModal } from './AuthModal';
import { useAuth } from '../context/AuthContext';
import { getUserDisplayName } from '../lib/auth-api';

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

function UserMenu({ onCloseMobile }: { onCloseMobile?: () => void }) {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  if (!user) return null;

  const closeAll = () => {
    setOpen(false);
    onCloseMobile?.();
  };

  return (
    <div className="header-user-wrap" ref={menuRef}>
      <button
        type="button"
        className={`header-user-btn${open ? ' header-user-btn-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
      >
        <span className="header-user-avatar">{user.firstName.charAt(0).toUpperCase()}</span>
        <span className="header-user-name hidden md:inline">{getUserDisplayName(user)}</span>
        {isAdmin ? (
          <span className="header-user-admin hidden lg:inline-flex">
            <Shield className="h-3.5 w-3.5" />
            Admin
          </span>
        ) : null}
        <ChevronDown className="h-4 w-4 header-user-chevron" />
      </button>

      {open && (
        <div className="header-user-dropdown">
          <div className="header-user-dropdown-head">
            <p className="header-user-dropdown-name">{getUserDisplayName(user)}</p>
            <p className="header-user-dropdown-email">{user.email}</p>
            {isAdmin ? <span className="header-user-dropdown-role">Администратор</span> : null}
          </div>
          <Link to="/profile" className="header-user-dropdown-link" onClick={closeAll}>
            <User className="h-4 w-4" />
            Профиль
          </Link>
          <button type="button" className="header-user-dropdown-link" onClick={() => { logout(); closeAll(); }}>
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export function Header({
  dark,
  onToggle,
  adminSimple = false,
}: {
  dark: boolean;
  onToggle: () => void;
  adminSimple?: boolean;
}) {
  const { user, loading } = useAuth();
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
    <header className="header-wave">
      <div className="header-body">
        <div className="header-dots" aria-hidden />
        <div className="wrap header-inner">
          <Link to="/questions" className="header-logo no-underline shrink-0">
            <img src="/logo-mualim.png" alt="MUALIM" className="header-logo-img" />
            <span className="header-brand-name">MUALIM</span>
          </Link>

          {!adminSimple ? (
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
          ) : (
            <p className="header-admin-label hidden sm:block">Суроо-жооп бөлümү</p>
          )}

          <div className="header-actions">
            {!adminSimple ? (
              <>
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
              </>
            ) : null}

            {!loading && user ? (
              <UserMenu />
            ) : (
              <button type="button" className="header-login-btn" onClick={() => openAuth('login')}>
                <User className="h-4 w-4" />
                Login
              </button>
            )}

            <button
              type="button"
              className="header-mobile-toggle lg:hidden"
              aria-label="Меню"
              onClick={() => !adminSimple && setMobileOpen(!mobileOpen)}
              style={adminSimple ? { visibility: 'hidden' } : undefined}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && !adminSimple && (
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
            {!loading && user ? (
              <div className="header-mobile-user">
                <UserMenu onCloseMobile={closeAll} />
                <Link to="/profile" className="header-login-btn header-login-btn-mobile" onClick={closeAll}>
                  <User className="h-4 w-4" />
                  Профиль
                </Link>
              </div>
            ) : (
              <button type="button" className="header-login-btn header-login-btn-mobile" onClick={() => openAuth('login')}>
                <User className="h-4 w-4" />
                Login
              </button>
            )}
          </nav>
        )}

        <div className="header-wave-edge" aria-hidden>
          <svg className="header-wave-svg" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <path
              d="M0,80 L0,120 L1440,120 L1440,20 C1200,60 960,0 720,40 C480,80 240,20 0,80 Z"
              className="header-wave-path-back"
            />
          </svg>
          <svg className="header-wave-svg header-wave-svg-front" viewBox="0 0 1440 100" preserveAspectRatio="none">
            <path
              d="M0,70 L0,100 L1440,100 L1440,0 C1080,50 720,10 360,55 C180,75 60,65 0,70 Z"
              className="header-wave-path-front"
            />
          </svg>
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialTab={authTab} />
    </header>
  );
}
