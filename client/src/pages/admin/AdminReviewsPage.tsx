import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, Search, Star, Trash2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { QaPagination } from '../../components/QaPagination';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminCourses } from '../../lib/admin-courses-api';
import {
  createAdminReview,
  deleteReview,
  fetchAdminReviews,
  moderateReview,
  type CourseReview,
  type ReviewStatus,
} from '../../lib/reviews-api';
import { getErrorMessage, toastError, toastSuccess } from '../../lib/toast';

const PER_PAGE = 20;

const TABS: { value: ReviewStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Бардыгы' },
  { value: 'pending', label: 'Күтүүдө' },
  { value: 'approved', label: 'Жактырылган' },
  { value: 'rejected', label: 'Четке кагылган' },
];

function statusLabel(status: ReviewStatus) {
  if (status === 'approved') return 'Жактырылган';
  if (status === 'rejected') return 'Четке кагылган';
  return 'Күтүүдө';
}

export function AdminReviewsPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ReviewStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<CourseReview[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [courses, setCourses] = useState<{ slug: string; title: string }[]>([]);
  const [courseRef, setCourseRef] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchAdminReviews(token, {
        status: tab === 'all' ? undefined : tab,
        page,
        limit: PER_PAGE,
        q: query || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      toastError(getErrorMessage(err, 'Жүктөө ийгиликсиз'));
    } finally {
      setLoading(false);
    }
  }, [token, tab, page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    void fetchAdminCourses(token, { limit: 100 }).then((data) => {
      setCourses(data.items.map((course) => ({ slug: course.slug, title: course.title })));
      setCourseRef((current) => current || data.items[0]?.slug || '');
    }).catch(() => {
      toastError('Курстар жүктөлгөн жок');
    });
  }, [token]);

  const runCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !courseRef || !comment.trim() || !displayName.trim()) return;
    setSaving(true);
    try {
      await createAdminReview(token, {
        courseRef,
        rating,
        comment: comment.trim(),
        displayName: displayName.trim(),
      });
      toastSuccess('Пикир кошулду');
      setComment('');
      setDisplayName('');
      setRating(5);
      setTab('approved');
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: ['public-reviews'] });
      await load();
    } catch (err) {
      toastError(getErrorMessage(err, 'Пикир кошулган жок'));
    } finally {
      setSaving(false);
    }
  };

  const runModerate = async (id: string, status: ReviewStatus) => {
    if (!token) return;
    setBusyId(id);
    try {
      await moderateReview(token, id, status);
      toastSuccess(status === 'approved' ? 'Пикир жактырылды' : 'Пикир четке кагылды');
      await queryClient.invalidateQueries({ queryKey: ['public-reviews'] });
      await load();
    } catch (err) {
      toastError(getErrorMessage(err, 'Өзгөртүлгөн жок'));
    } finally {
      setBusyId(null);
    }
  };

  const runDelete = async (id: string) => {
    if (!token) return;
    if (!window.confirm('Бул пикирди өчүрөсүзбү?')) return;
    setBusyId(id);
    try {
      await deleteReview(token, id);
      toastSuccess('Пикир өчүрүлдү');
      await queryClient.invalidateQueries({ queryKey: ['public-reviews'] });
      await load();
    } catch (err) {
      toastError(getErrorMessage(err, 'Өчүрүлгөн жок'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="admin-users-page">
      <header className="admin-section-header">
        <div>
          <h1 className="admin-section-title">Пикирлер</h1>
          <p className="admin-section-subtitle">
            Жылдызды жана ысымды сиз толтурасыз — окуучунун отзывуна жараша · {total} пикир
          </p>
        </div>
      </header>

      <form className="ui-card qa-admin-form" onSubmit={(event) => void runCreate(event)}>
        <p className="qa-admin-label">Жаңы отзыв</p>
        <div className="qa-admin-field">
          <label className="qa-admin-label" htmlFor="review-course">Курс</label>
          <AdminSelect
            id="review-course"
            value={courseRef}
            onChange={setCourseRef}
            options={courses.map((course) => ({ value: course.slug, label: course.title }))}
            placeholder="Курсту тандаңыз"
          />
        </div>
        <div className="qa-admin-field">
          <label className="qa-admin-label" htmlFor="review-name">Отзыв жазган адам</label>
          <input
            id="review-name"
            className="qa-admin-input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Мисалы: Айгерим Турсунова"
            maxLength={150}
            required
          />
        </div>
        <div className="qa-admin-field">
          <p className="qa-admin-label" id="review-rating-label">Жылдыз (админ толтурат)</p>
          <div className="admin-review-star-picker" role="group" aria-labelledby="review-rating-label">
            {Array.from({ length: 5 }, (_, i) => {
              const value = i + 1;
              return (
                <button
                  key={value}
                  type="button"
                  className="course-review-star-btn"
                  onClick={() => setRating(value)}
                  aria-label={`${value} жылдыз`}
                >
                  <Star
                    className={`course-star ${value <= rating ? 'course-star-filled' : ''}`}
                    fill={value <= rating ? 'currentColor' : 'none'}
                    strokeWidth={1.75}
                  />
                </button>
              );
            })}
            <span className="admin-section-subtitle m-0">{rating} / 5</span>
          </div>
        </div>
        <div className="qa-admin-field">
          <label className="qa-admin-label" htmlFor="review-comment">Отзыв тексти</label>
          <textarea
            id="review-comment"
            className="qa-admin-textarea"
            rows={8}
            maxLength={8000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Окуучунун отзывунун текстин бул жерге көчүрүңүз"
            required
          />
        </div>
        <div className="qa-admin-form-actions">
          <button type="submit" className="btn-primary" disabled={saving || !courseRef || !displayName.trim()}>
            {saving ? 'Сакталууда...' : 'Пикирди чыгаруу'}
          </button>
        </div>
      </form>

      <div className="qa-sort-row" role="tablist" aria-label="Пикир статусу">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`qa-sort-btn${tab === item.value ? ' qa-sort-btn-active' : ''}`}
            onClick={() => {
              setTab(item.value);
              setPage(1);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <form
        className="qa-admin-search"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(queryInput.trim());
        }}
      >
        <Search className="h-5 w-5" aria-hidden />
        <input
          type="search"
          className="qa-admin-search-input"
          value={queryInput}
          onChange={(event) => setQueryInput(event.target.value)}
          placeholder="Курс, автор, текст"
        />
      </form>

      <div className="ui-card admin-users-table-wrap">
        {loading ? (
          <p className="admin-placeholder-subtitle px-4 py-6">Жүктөлүүдө...</p>
        ) : items.length === 0 ? (
          <p className="admin-placeholder-subtitle px-4 py-6">Пикир жок.</p>
        ) : (
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>Автор</th>
                <th>Курс</th>
                <th>Баа</th>
                <th>Пикир</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.authorName}</strong>
                    {item.authorEmail ? (
                      <p className="admin-section-subtitle m-0">{item.authorEmail}</p>
                    ) : null}
                  </td>
                  <td>{item.courseTitle}</td>
                  <td>
                    <span className="admin-review-stars">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className="h-3.5 w-3.5"
                          fill={i < item.rating ? 'currentColor' : 'none'}
                        />
                      ))}
                    </span>
                  </td>
                  <td className="admin-review-comment">{item.comment || '—'}</td>
                  <td>
                    <span
                      className={`admin-users-status ${
                        item.status === 'approved'
                          ? 'admin-users-status-active'
                          : item.status === 'rejected'
                            ? 'admin-users-status-blocked'
                            : 'admin-review-status-pending'
                      }`}
                    >
                      {statusLabel(item.status)}
                    </span>
                  </td>
                  <td>
                    <div className="admin-review-actions">
                      {item.status !== 'approved' ? (
                        <button
                          type="button"
                          className="admin-review-btn"
                          disabled={busyId === item.id}
                          onClick={() => void runModerate(item.id, 'approved')}
                        >
                          <Check className="h-4 w-4" />
                          Жактыруу
                        </button>
                      ) : null}
                      {item.status !== 'rejected' ? (
                        <button
                          type="button"
                          className="admin-review-btn admin-review-btn-warn"
                          disabled={busyId === item.id}
                          onClick={() => void runModerate(item.id, 'rejected')}
                        >
                          <X className="h-4 w-4" />
                          Четке кагуу
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="admin-review-btn admin-review-btn-danger"
                        disabled={busyId === item.id}
                        onClick={() => void runDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 ? (
        <QaPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
    </section>
  );
}
