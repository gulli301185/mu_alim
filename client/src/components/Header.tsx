import { useState, useRef, useEffect, type RefObject } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Moon, Sun, Globe, Menu, X, ChevronDown, User, LogOut, Shield } from 'lucide-react';
import { NAV_PRIMARY, NAV_MENU, LANG_OPTIONS, type LangCode } from '../data/landing';
import { useAuthModal } from '../context/AuthModalContext';
import { useContactPanel } from '../context/ContactPanelContext';
import { useAuth } from '../context/AuthContext';
import { useSiteImages } from '../context/SiteImagesContext';
import { SITE_IMAGE_KEYS } from '../lib/site-images-api';
import { getUserDisplayName, type AuthUser } from '../lib/auth-api';

function navClass(isActive: boolean) {
  return isActive ? 'nav-active nav-link' : 'nav-link';
}

const CONTACT_HREF = '/#contact';

function HeaderNavLink({
  href,
  label,
  onClick,
  isHashActive,
  onOpenContact,
  contactOpen,
}: {
  href: string;
  label: string;
  onClick?: () => void;
  isHashActive?: (href: string) => boolean;
  onOpenContact?: () => void;
  contactOpen?: boolean;
}) {
  if (href === CONTACT_HREF) {
    return (
      <button
        type="button"
        className={navClass(contactOpen ?? false)}
        onClick={() => {
          onOpenContact?.();
          onClick?.();
        }}
      >
        {label}
      </button>
    );
  }

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
  onOpenContact,
  contactOpen,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  isHashActive: (href: string) => boolean;
  onOpenContact?: () => void;
  contactOpen?: boolean;
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
            item.href === CONTACT_HREF ? (
              <button
                key={item.label}
                type="button"
                className={`header-dropdown-link${contactOpen ? ' header-dropdown-link-active' : ''}`}
                onClick={() => {
                  onOpenContact?.();
                  onClose();
                }}
              >
                {item.label}
              </button>
            ) : item.href.startsWith('/#') ? (
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

function AuthButtons({
  loading,
  user,
  isAdmin,
  isLoggingOut,
  onLogin,
  onRegister,
  onLogout,
}: {
  loading: boolean;
  user: AuthUser | null;
  isAdmin: boolean;
  isLoggingOut: boolean;
  onLogin: () => void;
  onRegister: () => void;
  onLogout: () => void;
}) {
  if (loading) {
    return <span className="header-auth-loading">...</span>;
  }

  if (user && isAdmin) {
    return (
      <>
        <Link to="/admin" className="header-login-btn">
          <Shield className="h-4 w-4" />
          Админ
        </Link>
        <button
          type="button"
          className="header-logout-btn"
          onClick={onLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? 'Чыгууда...' : 'Чыгуу'}
        </button>
      </>
    );
  }

  if (user) {
    return (
      <>
        <UserMenu />
        <button
          type="button"
          className="header-logout-btn"
          onClick={onLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? 'Чыгууда...' : 'Logout'}
        </button>
      </>
    );
  }

  return (
    <>
      <button type="button" className="header-login-btn" onClick={onLogin}>
        <User className="h-4 w-4" />
        Кирүү
      </button>
      <button type="button" className="header-register-btn" onClick={onRegister}>
        Катталуу
      </button>
    </>
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
            Админ
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
          {isAdmin ? (
            <Link to="/admin" className="header-user-dropdown-link" onClick={closeAll}>
              <Shield className="h-4 w-4" />
              Админ панель
            </Link>
          ) : (
            <Link to="/profile" className="header-user-dropdown-link" onClick={closeAll}>
              <User className="h-4 w-4" />
              Профиль
            </Link>
          )}
          <button type="button" className="header-user-dropdown-link" onClick={() => { logout(); closeAll(); }}>
            <LogOut className="h-4 w-4" />
            Чыгуу
          </button>
        </div>
      )}
    </div>
  );
}

export function Header({
  dark,
  onToggle,
  adminArea = false,
  adminSimple = false,
}: {
  dark: boolean;
  onToggle: () => void;
  adminArea?: boolean;
  adminSimple?: boolean;
}) {
  const { user, loading, logout, isLoggingOut, isAdmin } = useAuth();
  const { openAuth } = useAuthModal();
  const { contactOpen, openContact, closeContact } = useContactPanel();
  const { image } = useSiteImages();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState<LangCode>(() => {
    const saved = localStorage.getItem('lang');
    return saved === 'ru' || saved === 'en' || saved === 'kg' ? saved : 'kg';
  });
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
    closeContact();
  }, [pathname, closeContact]);

  useEffect(() => {
    localStorage.setItem('lang', lang);
    document.documentElement.lang = lang === 'kg' ? 'ky' : lang;
  }, [lang]);

  const closeAll = () => {
    setMobileOpen(false);
    setMenuOpen(false);
  };

  const openAuthModal = (tab: 'login' | 'register' = 'login') => {
    if (adminArea || isAdmin) return;
    openAuth(tab);
    closeAll();
  };

  const openContactPanel = () => {
    openContact();
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
        onOpenContact={openContactPanel}
        contactOpen={contactOpen}
      />
    ));

  return (
    <header className="header-wave">
      <div className="header-body">
        <div className="header-dots" aria-hidden />
        <div className="wrap header-inner">
          <Link
            to={adminArea ? '/admin/questions' : '/'}
            className="header-logo no-underline shrink-0"
          >
            <img src={image(SITE_IMAGE_KEYS.logo)} alt="" className="header-logo-img" aria-hidden />
            <span className="header-brand-wordmark" aria-label="Mualim Academy">
              <span className="header-brand-wordmark-text">
                <span className="header-brand-wordmark-gold">Mu</span>
                <span className="header-brand-wordmark-light">alim</span>
              </span>
            </span>
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
                onOpenContact={openContactPanel}
                contactOpen={contactOpen}
              />
            </nav>
          ) : (
            <p className="header-admin-label hidden sm:block">Суроо-жооп бөлүмү</p>
          )}

          <div className="header-actions">
            {!adminSimple ? (
              <>
                <button type="button" onClick={onToggle} className="theme-btn hidden lg:flex" aria-label="Тема">
                  {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  <span className="hidden md:inline">{dark ? 'Жарык' : 'Караңгы'}</span>
                </button>

                <div className="header-lang-wrap hidden lg:inline-flex">
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

            <div className="header-auth-actions">
              {!adminArea ? (
                <AuthButtons
                  loading={loading}
                  user={user}
                  isAdmin={isAdmin}
                  isLoggingOut={isLoggingOut}
                  onLogin={() => openAuthModal('login')}
                  onRegister={() => openAuthModal('register')}
                  onLogout={logout}
                />
              ) : isAdmin ? (
                <AuthButtons
                  loading={loading}
                  user={user}
                  isAdmin={isAdmin}
                  isLoggingOut={isLoggingOut}
                  onLogin={() => openAuthModal('login')}
                  onRegister={() => openAuthModal('register')}
                  onLogout={logout}
                />
              ) : null}
            </div>

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
            <div className="header-mobile-tools">
              <div className="header-lang-wrap header-lang-wrap-mobile">
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
              <button
                type="button"
                onClick={() => { onToggle(); closeAll(); }}
                className="theme-btn theme-btn-mobile"
                aria-label="Тема"
              >
                {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {dark ? 'Жарык' : 'Караңгы'}
              </button>
            </div>
            {!loading && user && !isAdmin ? (
              <div className="header-mobile-user">
                <UserMenu onCloseMobile={closeAll} />
                <Link to="/profile" className="header-login-btn header-login-btn-mobile" onClick={closeAll}>
                  <User className="h-4 w-4" />
                  Профиль
                </Link>
                <button
                  type="button"
                  className="header-logout-btn header-login-btn-mobile"
                  onClick={() => { logout(); closeAll(); }}
                  disabled={isLoggingOut}
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? 'Чыгууда...' : 'Logout'}
                </button>
              </div>
            ) : !loading && user && isAdmin ? (
              <div className="header-mobile-auth">
                <Link to="/admin" className="header-login-btn header-login-btn-mobile" onClick={closeAll}>
                  <Shield className="h-4 w-4" />
                  Админ панель
                </Link>
                <button
                  type="button"
                  className="header-logout-btn header-login-btn-mobile"
                  onClick={() => { logout(); closeAll(); }}
                  disabled={isLoggingOut}
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? 'Чыгууда...' : 'Чыгуу'}
                </button>
              </div>
            ) : (
              <div className="header-mobile-auth">
                <button type="button" className="header-login-btn header-login-btn-mobile" onClick={() => openAuthModal('login')}>
                  <User className="h-4 w-4" />
                  Кирүү
                </button>
                <button type="button" className="header-register-btn header-login-btn-mobile" onClick={() => openAuthModal('register')}>
                  Катталуу
                </button>
              </div>
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

    </header>
  );
}
