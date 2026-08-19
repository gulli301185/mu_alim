import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { QaPagination } from '../../components/QaPagination';
import { useAuth } from '../../context/AuthContext';
import {
  fetchAdminUsers,
  formatAdminDate,
  getAdminUserDisplayName,
  type AdminUserListItem,
} from '../../lib/admin-users-api';
import { getErrorMessage, toastError } from '../../lib/toast';

const USERS_PER_PAGE = 20;

export function AdminUsersPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryInput, setQueryInput] = useState(() => searchParams.get('q') ?? '');
  const [items, setItems] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const query = searchParams.get('q') ?? '';

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUsers(token, {
        page,
        limit: USERS_PER_PAGE,
        search: query || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      toastError(getErrorMessage(err, 'Жүктөө ийгиликсиз'));
      setError('load');
    } finally {
      setLoading(false);
    }
  }, [token, page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const trimmed = queryInput.trim();
          if (trimmed) next.set('q', trimmed);
          else next.delete('q');
          next.set('page', '1');
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [queryInput, setSearchParams]);

  const currentPage = Math.min(page, totalPages);

  return (
    <section className="admin-users-page">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-section-title">Колдонуучулар</h2>
          <p className="admin-section-subtitle">Бардыгы: {total}</p>
        </div>
      </header>

      <label className="qa-admin-search">
        <Search className="h-5 w-5" aria-hidden />
        <input
          type="search"
          className="qa-admin-search-input"
          placeholder="Аты, почта же телефон боюнча издөө..."
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
        />
      </label>

      {error ? (
        <div className="qa-empty ui-card">
          <p>Жүктөлбөдү.</p>
          <button type="button" className="btn-gold qa-admin-btn" onClick={() => void load()}>
            Кайра жүктөө
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="qa-empty ui-card">
          <p>Жүктөлүүдө...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="qa-empty ui-card">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden />
          <p>Колдонуучулар табылган жок.</p>
        </div>
      ) : (
        <div className="admin-users-table-wrap ui-card">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Колдонуучу</th>
                <th>Электрондук почта</th>
                <th>Курстар</th>
                <th>Сертификат</th>
                <th>Акыркы кирүү</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="admin-users-name-cell">
                      <span className="admin-users-avatar">{user.firstName.charAt(0).toUpperCase()}</span>
                      <span>{getAdminUserDisplayName(user)}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.enrollmentsCount}</td>
                  <td>{user.certificatesCount}</td>
                  <td>{formatAdminDate(user.lastLoginAt)}</td>
                  <td>
                    <span
                      className={`admin-users-status${user.isActive ? ' admin-users-status-active' : ' admin-users-status-blocked'}`}
                    >
                      {user.isActive ? 'Активдүү' : 'Блоктоолгон'}
                    </span>
                  </td>
                  <td>
                    <Link to={`/admin/users/${user.id}`} className="qa-admin-btn qa-admin-btn-muted">
                      Көрүү
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && totalPages > 1 ? (
        <QaPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(nextPage) => {
            setSearchParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                next.set('page', String(nextPage));
                return next;
              },
              { replace: true },
            );
          }}
        />
      ) : null}
    </section>
  );
}
