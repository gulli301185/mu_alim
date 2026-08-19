import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
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

export function RequireAdmin() {
  const { loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;
  if (!isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}

export function RequireUser() {
  const { loading, user, isAdmin } = useAuth();

  if (loading) return <AuthLoading />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (!user) return <Navigate to="/" replace />;

  return <Outlet />;
}

export function BlockAdminFromUserArea() {
  const { loading, isAdmin } = useAuth();

  if (loading) return <AuthLoading />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  return <Outlet />;
}

export function BlockUserFromAdminArea() {
  const { loading, sessionKind, user } = useAuth();

  if (loading) return <AuthLoading />;
  if (sessionKind === 'user' && user) return <Navigate to="/" replace />;

  return <Outlet />;
}

export function AdminGuestOnly({ children }: { children: ReactNode }) {
  const { loading, isAdmin, user, sessionKind } = useAuth();

  if (loading) return <AuthLoading />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (sessionKind === 'user' && user) return <Navigate to="/" replace />;

  return children;
}
