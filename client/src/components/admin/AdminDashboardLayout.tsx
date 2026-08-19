import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { ADMIN_NAV, findAdminNavItem } from '../../data/admin-nav';
import { useAuth } from '../../context/AuthContext';
import { getUserDisplayName } from '../../lib/auth-api';

function getInitialDark(): boolean {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function AdminDashboardLayout() {
  const { user, logout, isLoggingOut } = useAuth();
  const { pathname } = useLocation();
  const [dark, setDark] = useState(getInitialDark);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const current = findAdminNavItem(pathname);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className={`admin-dashboard${dark ? ' dark' : ''}`}>
      <div
        className={`admin-sidebar-backdrop${sidebarOpen ? ' admin-sidebar-backdrop-open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      <aside className={`admin-sidebar${sidebarOpen ? ' admin-sidebar-open' : ''}`}>
        <div className="admin-sidebar-head">
          <NavLink to="/admin" className="admin-sidebar-brand" onClick={() => setSidebarOpen(false)}>
            <img src="/logo-mualim.png" alt="" className="admin-sidebar-logo" />
            <span>
              <strong>МУАЛИМ</strong>
              <small>Админ панель</small>
            </span>
          </NavLink>
          <button
            type="button"
            className="admin-sidebar-close lg:hidden"
            aria-label="Жабуу"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          {ADMIN_NAV.map((group) => (
            <div key={group.title ?? group.items[0]?.to} className="admin-nav-group">
              {group.title ? <p className="admin-nav-group-title">{group.title}</p> : null}
              <ul className="admin-nav-list">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          `admin-nav-link${isActive ? ' admin-nav-link-active' : ''}`
                        }
                        onClick={() => setSidebarOpen(false)}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span>{item.label}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="admin-dashboard-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-topbar-menu lg:hidden"
              aria-label="Меню"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="admin-topbar-title">{current?.label ?? 'Админ панель'}</h1>
              {current?.description ? (
                <p className="admin-topbar-subtitle">{current.description}</p>
              ) : null}
            </div>
          </div>

          <div className="admin-topbar-actions">
            <button
              type="button"
              className="admin-topbar-icon-btn"
              aria-label="Тема"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {user ? (
              <div className="admin-topbar-user">
                <span className="admin-topbar-avatar">{user.firstName.charAt(0).toUpperCase()}</span>
                <span className="admin-topbar-name hidden sm:inline">{getUserDisplayName(user)}</span>
              </div>
            ) : null}
            <button
              type="button"
              className="admin-topbar-logout"
              onClick={logout}
              disabled={isLoggingOut}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{isLoggingOut ? 'Чыгууда...' : 'Чыгуу'}</span>
            </button>
          </div>
        </header>

        <main className="admin-dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
