import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Plus, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { courseTypeLabel, type CourseType } from '../../lib/course-api';
import { fetchAdminCourses, type AdminCourseItem } from '../../lib/admin-courses-api';
import { getErrorMessage, toastError } from '../../lib/toast';

const TABS: { value: CourseType | 'all'; label: string }[] = [
  { value: 'all', label: 'Бардыгы' },
  { value: 'free', label: 'Бекер' },
  { value: 'paid', label: 'Акылуу' },
];

export function AdminCoursesPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('type') as CourseType | 'all' | null) ?? 'all';
  const [queryInput, setQueryInput] = useState('');
  const [items, setItems] = useState<AdminCourseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminCourses(token, {
        type: tab === 'all' ? undefined : tab,
        limit: 100,
      });
      const filtered = queryInput.trim()
        ? data.items.filter((item) =>
            item.title.toLowerCase().includes(queryInput.trim().toLowerCase()),
          )
        : data.items;
      setItems(filtered);
      setTotal(data.total);
    } catch (err) {
      toastError(getErrorMessage(err, 'Жүктөө ийгиликсиз'));
      setError('load');
    } finally {
      setLoading(false);
    }
  }, [token, tab, queryInput]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="admin-users-page">
      <header className="admin-section-header">
        <div>
          <h2 className="admin-section-title">Курстар</h2>
          <p className="admin-section-subtitle">Курстар жана YouTube сабактар · бардыгы {total}</p>
        </div>
        <Link to="/admin/courses/new" className="btn-gold qa-admin-btn qa-admin-btn-add">
          <Plus className="h-5 w-5" />
          Жаңы курс
        </Link>
      </header>

      <div className="qa-sort-row" role="tablist" aria-label="Курс түрү">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`qa-sort-btn${tab === item.value ? ' qa-sort-btn-active' : ''}`}
            onClick={() => {
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  if (item.value === 'all') next.delete('type');
                  else next.set('type', item.value);
                  return next;
                },
                { replace: true },
              );
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className="qa-admin-search">
        <Search className="h-5 w-5" aria-hidden />
        <input
          type="search"
          className="qa-admin-search-input"
          placeholder="Курс аталышы боюнча издөө..."
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
          <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden />
          <p>Курстар табылган жок.</p>
        </div>
      ) : (
        <div className="admin-users-table-wrap ui-card">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Аталышы</th>
                <th>Түрү</th>
                <th>Баасы</th>
                <th>Сабактар</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((course) => (
                <tr key={course.recordId}>
                  <td>{course.title}</td>
                  <td>
                    <span
                      className={`admin-users-status ${
                        course.courseType === 'free'
                          ? 'admin-users-status-active'
                          : 'admin-course-type-paid'
                      }`}
                    >
                      {courseTypeLabel(course.courseType)}
                    </span>
                  </td>
                  <td>{course.priceLabel}</td>
                  <td>{course.lessonsCount}</td>
                  <td>{course.isPublished ? 'Жарыяланган' : 'Ж чертөө'}</td>
                  <td>
                    <Link
                      to={`/admin/courses/${course.slug}`}
                      className="qa-admin-btn qa-admin-btn-muted"
                    >
                      Башкаруу
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
