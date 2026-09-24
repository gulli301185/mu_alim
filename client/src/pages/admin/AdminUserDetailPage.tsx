import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Ban, BookOpen, CheckCircle2, Mail, Phone, ShieldCheck, Trash2, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminCourses } from '../../lib/admin-courses-api';
import {
  courseTypeLabel,
  deleteAdminUser,
  enrollmentStatusLabel,
  fetchAdminUserDetail,
  formatAdminDate,
  getAdminUserDisplayName,
  grantAdminUserEnrollment,
  updateAdminUserStatus,
  type AdminUserDetailResponse,
} from '../../lib/admin-users-api';
import { getErrorMessage, toastError, toastSuccess } from '../../lib/toast';

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [data, setData] = useState<AdminUserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paidCourses, setPaidCourses] = useState<{ id: string; slug: string; title: string; priceLabel: string }[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [granting, setGranting] = useState(false);

  const load = useCallback(async () => {
    if (!token || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdminUserDetail(token, userId);
      setData(response);
    } catch (err) {
      toastError(getErrorMessage(err, 'Жүктөө ийгиликсиз'));
      setError('load');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const response = await fetchAdminCourses(token, { type: 'paid', limit: 100 });
        setPaidCourses(
          response.items.map((course) => ({
            id: course.recordId,
            slug: course.slug,
            title: course.title,
            priceLabel: course.priceLabel,
          })),
        );
      } catch {
        setPaidCourses([]);
      }
    })();
  }, [token]);

  const handleToggleStatus = async () => {
    if (!token || !data) return;
    setSavingStatus(true);
    try {
      const updated = await updateAdminUserStatus(token, data.user.id, !data.user.isActive);
      setData((prev) => (prev ? { ...prev, user: { ...prev.user, isActive: updated.isActive } } : prev));
    } catch (err) {
      toastError(getErrorMessage(err, 'Статус өзгөртүү ийгиликсиз'));
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!token || !data) return;
    const name = getAdminUserDisplayName(data.user);
    if (!window.confirm(`"${name}" колдонуучусун чын эле өчүрөсүзбү? Бул аракет кайтарылбайт.`)) return;
    setDeleting(true);
    try {
      await deleteAdminUser(token, data.user.id);
      toastSuccess('Колдонуучу өчүрүлдү');
      navigate('/admin/users');
    } catch (err) {
      toastError(getErrorMessage(err, 'Колдонуучуну өчүрүү ийгиликсиз'));
      setDeleting(false);
    }
  };

  const enrolledCourseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of data?.enrollments ?? []) {
      if (item.status !== 'active' && item.status !== 'completed') continue;
      ids.add(item.course.id);
      if (item.course.slug) ids.add(item.course.slug);
    }
    return ids;
  }, [data?.enrollments]);

  const grantableCourses = paidCourses.filter(
    (course) => !enrolledCourseIds.has(course.id) && !enrolledCourseIds.has(course.slug ?? ''),
  );

  const handleGrantAccess = async () => {
    if (!token || !data || !selectedCourseId) return;
    setGranting(true);
    try {
      const result = await grantAdminUserEnrollment(token, data.user.id, selectedCourseId);
      toastSuccess(
        result.alreadyActive ? 'Бул курс үчүн доступ мурда ачылган' : 'Курс үчүн доступ ийгиликтүү берилди',
      );
      setSelectedCourseId('');
      await load();
    } catch (err) {
      toastError(getErrorMessage(err, 'Доступ берүү ийгиликсиз'));
    } finally {
      setGranting(false);
    }
  };

  if (loading) {
    return (
      <div className="qa-empty ui-card">
        <p>Жүктөлүүдө...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="qa-empty ui-card">
        <p>Колдонуучу табылган жок</p>
        <Link to="/admin/users" className="btn-gold qa-admin-btn">
          Артка
        </Link>
      </div>
    );
  }

  const { user, enrollments, courseProgress, certificates } = data;
  const activeCourses = courseProgress.filter((item) => !item.isCompleted);
  const completedCourses = courseProgress.filter((item) => item.isCompleted);

  return (
    <section className="admin-user-detail">
      <Link to="/admin/users" className="qa-admin-back">
        <ArrowLeft className="h-5 w-5" />
        Колдонуучуларга кайтуу
      </Link>

      <div className="admin-user-detail-grid">
        <aside className="ui-card admin-user-profile-card">
          <div className="admin-user-profile-head">
            <span className="admin-user-profile-avatar">{user.firstName.charAt(0).toUpperCase()}</span>
            <div>
              <h2 className="admin-user-profile-name">{getAdminUserDisplayName(user)}</h2>
              <p className="admin-user-profile-email">{user.email}</p>
            </div>
          </div>

          <ul className="admin-user-meta-list">
            <li>
              <User className="h-4 w-4" aria-hidden />
              <span>{user.firstName} {user.lastName}</span>
            </li>
            <li>
              <Mail className="h-4 w-4" aria-hidden />
              <span>{user.email}</span>
            </li>
            {user.phone ? (
              <li>
                <Phone className="h-4 w-4" aria-hidden />
                <span>{user.phone}</span>
              </li>
            ) : null}
          </ul>

          <dl className="admin-user-dates">
            <div>
              <dt>Катталган</dt>
              <dd>{formatAdminDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt>Акыркы кирүү</dt>
              <dd>{formatAdminDate(user.lastLoginAt)}</dd>
            </div>
          </dl>

          <div className="admin-user-status-row">
            <span
              className={`admin-users-status${user.isActive ? ' admin-users-status-active' : ' admin-users-status-blocked'}`}
            >
              {user.isActive ? 'Активдүү' : 'Блоктоолгон'}
            </span>
            <button
              type="button"
              className={`qa-admin-btn${user.isActive ? ' qa-admin-btn-danger' : ' qa-admin-btn-muted'}`}
              onClick={() => void handleToggleStatus()}
              disabled={savingStatus || deleting}
            >
              <Ban className="h-4 w-4" />
              {savingStatus ? 'Сакталууда...' : user.isActive ? 'Блоктоо' : 'Блоктон чыгаруу'}
            </button>
            <button
              type="button"
              className="qa-admin-btn qa-admin-btn-danger"
              onClick={() => void handleDeleteUser()}
              disabled={deleting || savingStatus}
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Өчүрүлүүдө...' : 'Өчүрүү'}
            </button>
          </div>
        </aside>

        <div className="admin-user-sections">
          <section className="ui-card admin-user-section">
            <header className="admin-user-section-head">
              <ShieldCheck className="h-5 w-5" aria-hidden />
              <div>
                <h3>Курска доступ берүү</h3>
                <p>WhatsApp чек ырасталганда менеджер тандап берет</p>
              </div>
            </header>

            {grantableCourses.length === 0 ? (
              <p className="admin-user-empty">Бардык акылуу курстар үчүн доступ бар же курс жок.</p>
            ) : (
              <div className="admin-user-grant-form">
                <label className="admin-user-grant-label">
                  <span>Курс</span>
                  <select
                    className="admin-user-grant-select"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    disabled={granting}
                  >
                    <option value="">Тандаңыз...</option>
                    {grantableCourses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title} ({course.priceLabel})
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-gold qa-admin-btn"
                  onClick={() => void handleGrantAccess()}
                  disabled={granting || !selectedCourseId}
                >
                  {granting ? 'Берилүүдө...' : 'Доступ берүү'}
                </button>
              </div>
            )}
          </section>

          <section className="ui-card admin-user-section">
            <header className="admin-user-section-head">
              <BookOpen className="h-5 w-5" aria-hidden />
              <div>
                <h3>Учурда окуган курстар</h3>
                <p>Активдүү прогресси бар курстар</p>
              </div>
            </header>

            {activeCourses.length === 0 ? (
              <p className="admin-user-empty">Азыр активдүү курс жок.</p>
            ) : (
              <ul className="admin-user-course-list">
                {activeCourses.map((item) => (
                  <li key={item.id} className="admin-user-course-item">
                    <div>
                      <p className="admin-user-course-title">{item.course.title}</p>
                      <p className="admin-user-course-meta">
                        {courseTypeLabel(item.course.courseType)} · Жаңыртылган: {formatAdminDate(item.updatedAt)}
                      </p>
                      {item.lastLesson ? (
                        <p className="admin-user-course-meta">
                          Акыркы сабак: №{item.lastLesson.lessonOrder} — {item.lastLesson.title}
                        </p>
                      ) : null}
                    </div>
                    <div className="admin-user-progress-wrap">
                      <span className="admin-user-progress-value">{item.progressPercent}%</span>
                      <div className="admin-user-progress-bar">
                        <span style={{ width: `${Math.min(100, item.progressPercent)}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ui-card admin-user-section">
            <header className="admin-user-section-head">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              <div>
                <h3>Өтүп бүткөн курстар</h3>
                <p>Аякталган окуу таржымалы</p>
              </div>
            </header>

            {completedCourses.length === 0 && enrollments.filter((e) => e.status === 'completed').length === 0 ? (
              <p className="admin-user-empty">Аякталган курс жок.</p>
            ) : (
              <ul className="admin-user-course-list">
                {completedCourses.map((item) => (
                  <li key={item.id} className="admin-user-course-item">
                    <div>
                      <p className="admin-user-course-title">{item.course.title}</p>
                      <p className="admin-user-course-meta">
                        {courseTypeLabel(item.course.courseType)} · Аяктаган: {formatAdminDate(item.completedAt)}
                      </p>
                    </div>
                    <span className="admin-users-status admin-users-status-active">100%</span>
                  </li>
                ))}
                {enrollments
                  .filter((item) => item.status === 'completed')
                  .filter((item) => !completedCourses.some((p) => p.course.id === item.course.id))
                  .map((item) => (
                    <li key={item.id} className="admin-user-course-item">
                      <div>
                        <p className="admin-user-course-title">{item.course.title}</p>
                        <p className="admin-user-course-meta">
                          {enrollmentStatusLabel(item.status)} · {formatAdminDate(item.completedAt)}
                        </p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <section className="ui-card admin-user-section">
            <header className="admin-user-section-head">
              <BookOpen className="h-5 w-5" aria-hidden />
              <div>
                <h3>Катталган курстар</h3>
                <p>Бардык enrollments</p>
              </div>
            </header>

            {enrollments.length === 0 ? (
              <p className="admin-user-empty">Катталган курс жок.</p>
            ) : (
              <ul className="admin-user-course-list">
                {enrollments.map((item) => (
                  <li key={item.id} className="admin-user-course-item">
                    <div>
                      <p className="admin-user-course-title">{item.course.title}</p>
                      <p className="admin-user-course-meta">
                        {courseTypeLabel(item.course.courseType)} · {enrollmentStatusLabel(item.status)}
                      </p>
                      <p className="admin-user-course-meta">
                        Катталган: {formatAdminDate(item.enrolledAt)}
                        {item.completedAt ? ` · Аяктаган: ${formatAdminDate(item.completedAt)}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ui-card admin-user-section">
            <header className="admin-user-section-head">
              <Award className="h-5 w-5" aria-hidden />
              <div>
                <h3>Сертификаттар</h3>
                <p>Берилген сертификаттар</p>
              </div>
            </header>

            {certificates.length === 0 ? (
              <p className="admin-user-empty">Сертификат берилген эмес.</p>
            ) : (
              <ul className="admin-user-cert-list">
                {certificates.map((item) => (
                  <li key={item.id} className="admin-user-cert-item">
                    <div>
                      <p className="admin-user-course-title">{item.course.title}</p>
                      {item.recipientName ? (
                        <p className="admin-user-course-meta">Аты: {item.recipientName}</p>
                      ) : null}
                      <p className="admin-user-course-meta">№ {item.certificateNumber}</p>
                      <p className="admin-user-course-meta">Берилген: {formatAdminDate(item.issuedAt)}</p>
                    </div>
                    <span className="admin-user-cert-badge">
                      <Award className="h-4 w-4" />
                      Сертификат
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
