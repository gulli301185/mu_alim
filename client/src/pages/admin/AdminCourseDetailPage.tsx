import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { courseTypeLabel, formatCourseDuration } from '../../lib/course-api';
import {
  createAdminCourse,
  createAdminLesson,
  deleteAdminCourse,
  fetchAdminCourse,
  fetchAdminCourseLessons,
  updateAdminCourse,
  type LessonDto,
} from '../../lib/admin-courses-api';
import { deleteLesson, updateLesson } from '../../lib/lesson-api';
import { AdminSelect } from '../../components/admin/AdminSelect';
import { getErrorMessage, toastError } from '../../lib/toast';

type LessonFormState = {
  title: string;
  youtubeUrl: string;
  lessonOrder: string;
  duration: string;
  description: string;
  isPublished: boolean;
};

function emptyLessonForm(nextOrder: number): LessonFormState {
  return {
    title: '',
    youtubeUrl: '',
    lessonOrder: String(nextOrder),
    duration: '',
    description: '',
    isPublished: true,
  };
}

function parseDurationInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

function formatDurationInput(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function lessonToForm(lesson: LessonDto): LessonFormState {
  return {
    title: lesson.title,
    youtubeUrl: `https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`,
    lessonOrder: String(lesson.lessonOrder),
    duration: formatDurationInput(lesson.durationSeconds),
    description: lesson.description ?? '',
    isPublished: lesson.isPublished,
  };
}

export function AdminCourseDetailPage() {
  const { courseRef } = useParams<{ courseRef: string }>();
  const isNew = courseRef === 'new';
  const { token } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [lessons, setLessons] = useState<LessonDto[]>([]);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState<LessonFormState>(emptyLessonForm(1));

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [courseType, setCourseType] = useState<'free' | 'paid'>('free');
  const [price, setPrice] = useState('0');
  const [isPublished, setIsPublished] = useState(true);

  const loadLessons = useCallback(async () => {
    if (!token || !courseRef || isNew) return;
    const data = await fetchAdminCourseLessons(token, courseRef);
    setLessons(data);
    return data;
  }, [token, courseRef, isNew]);

  useEffect(() => {
    if (isNew || !courseRef || !token) return;
    setLoading(true);
    void (async () => {
      try {
        const course = await fetchAdminCourse(token, courseRef);
        setTitle(course.title);
        setSlug(course.slug);
        setDescription(course.description);
        setCourseType(course.courseType);
        setPrice(String(course.price));
        setIsPublished(course.isPublished);
        await loadLessons();
      } catch (err) {
        toastError(getErrorMessage(err, 'Жүктөө ийгиликсиз'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isNew, courseRef, token, loadLessons]);

  const closeLessonForm = () => {
    setShowLessonForm(false);
    setEditingLessonId(null);
    setLessonForm(emptyLessonForm(lessons.length + 1));
  };

  const openCreateLessonForm = () => {
    setEditingLessonId(null);
    setLessonForm(emptyLessonForm(lessons.length + 1));
    setShowLessonForm(true);
  };

  const openEditLessonForm = (lesson: LessonDto) => {
    setEditingLessonId(lesson.id);
    setLessonForm(lessonToForm(lesson));
    setShowLessonForm(true);
  };

  const handleSaveCourse = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        description: description.trim(),
        courseType,
        price: courseType === 'paid' ? Number(price) || 0 : 0,
        isPublished,
      };

      if (isNew) {
        const created = await createAdminCourse(token, payload);
        navigate(`/admin/courses/${created.slug}`, { replace: true });
      } else if (courseRef) {
        await updateAdminCourse(token, courseRef, payload);
      }
    } catch (err) {
      toastError(getErrorMessage(err, 'Сактоо ийгиликсиз'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLesson = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !courseRef || isNew) return;
    setSaving(true);
    try {
      const durationSeconds = parseDurationInput(lessonForm.duration);
      const payload = {
        title: lessonForm.title.trim(),
        description: lessonForm.description.trim() || undefined,
        youtubeUrl: lessonForm.youtubeUrl.trim(),
        lessonOrder: Number(lessonForm.lessonOrder) || 1,
        durationSeconds,
        isPublished: lessonForm.isPublished,
      };

      if (editingLessonId) {
        await updateLesson(token, editingLessonId, payload);
      } else {
        await createAdminLesson(token, courseRef, payload);
      }

      closeLessonForm();
      const data = await loadLessons();
      if (data) setLessonForm(emptyLessonForm(data.length + 1));
    } catch (err) {
      toastError(getErrorMessage(err, 'Сабак сакталган жок'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLesson = async (lesson: LessonDto) => {
    if (!token) return;
    const ok = window.confirm(`"${lesson.title}" сабагын өчүрөсүзбү?`);
    if (!ok) return;
    try {
      await deleteLesson(token, lesson.id);
      if (editingLessonId === lesson.id) closeLessonForm();
      await loadLessons();
    } catch (err) {
      toastError(getErrorMessage(err, 'Өчүрүү ийгиликсиз'));
    }
  };

  const handleTogglePublish = async (lesson: LessonDto) => {
    if (!token) return;
    try {
      await updateLesson(token, lesson.id, { isPublished: !lesson.isPublished });
      await loadLessons();
    } catch (err) {
      toastError(getErrorMessage(err, 'Статус өзгөрүлбөдү'));
    }
  };

  const handleDeleteCourse = async () => {
    if (!token || !courseRef || isNew) return;
    const ok = window.confirm('Бул курсту толук өчүрөсүзбү?');
    if (!ok) return;
    try {
      await deleteAdminCourse(token, courseRef);
      navigate('/admin/courses', { replace: true });
    } catch (err) {
      toastError(getErrorMessage(err, 'Өчүрүү ийгиликсиз'));
    }
  };

  if (!courseRef) return <Navigate to="/admin/courses" replace />;

  if (loading) {
    return (
      <div className="qa-empty ui-card">
        <p>Жүктөлүүдө...</p>
      </div>
    );
  }

  return (
    <section className="admin-user-detail">
      <Link to="/admin/courses" className="qa-admin-back">
        <ArrowLeft className="h-5 w-5" />
        Курстарга кайтуу
      </Link>

      <div className="admin-user-detail-grid">
        <form className="ui-card admin-user-profile-card admin-course-form" onSubmit={(e) => void handleSaveCourse(e)}>
          <h2 className="admin-section-title">{isNew ? 'Жаңы курс' : 'Курс маалыматы'}</h2>

          <label className="qa-admin-field">
            <span className="qa-admin-label">Аталышы</span>
            <input className="qa-admin-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>

          <label className="qa-admin-field">
            <span className="qa-admin-label">Slug</span>
            <input className="qa-admin-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="free-bayanlar" />
          </label>

          <label className="qa-admin-field">
            <span className="qa-admin-label">Сүрөттөмө</span>
            <textarea className="qa-admin-textarea" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </label>

          <label className="qa-admin-field">
            <span className="qa-admin-label">Түрү</span>
            <AdminSelect
              value={courseType}
              onChange={(value) => setCourseType(value as 'free' | 'paid')}
              options={[
                { value: 'free', label: 'Бекер' },
                { value: 'paid', label: 'Акылуу' },
              ]}
              aria-label="Курс түрү"
            />
          </label>

          {courseType === 'paid' ? (
            <label className="qa-admin-field">
              <span className="qa-admin-label">Баасы (KGS)</span>
              <input
                type="number"
                min={0}
                className="qa-admin-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
          ) : null}

          <label className="qa-admin-field admin-course-checkbox">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
            <span>Жарыялоо</span>
          </label>

          <div className="qa-admin-form-actions">
            <button type="submit" className="btn-gold qa-admin-btn" disabled={saving}>
              {saving ? 'Сакталууда...' : 'Сактоо'}
            </button>
            {!isNew ? (
              <button type="button" className="qa-admin-btn qa-admin-btn-danger" onClick={() => void handleDeleteCourse()}>
                <Trash2 className="h-4 w-4" />
                Курс өчүрүү
              </button>
            ) : null}
          </div>
        </form>

        {!isNew ? (
          <div className="admin-user-sections">
            <section className="ui-card admin-user-section">
              <header className="admin-user-section-head">
                <div>
                  <h3>YouTube сабактар</h3>
                  <p>{courseTypeLabel(courseType)} · {lessons.length} сабак</p>
                </div>
                <button
                  type="button"
                  className="btn-gold qa-admin-btn"
                  onClick={() => (showLessonForm && !editingLessonId ? closeLessonForm() : openCreateLessonForm())}
                >
                  {showLessonForm && !editingLessonId ? (
                    <>
                      <X className="h-4 w-4" />
                      Жабуу
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Сабак кошуу
                    </>
                  )}
                </button>
              </header>

              {showLessonForm ? (
                <form className="admin-lesson-form" onSubmit={(e) => void handleSaveLesson(e)}>
                  <h4 className="admin-lesson-form-title">
                    {editingLessonId ? 'Сабакты редакциялоо' : 'Жаңы сабак'}
                  </h4>
                  <label className="qa-admin-field">
                    <span className="qa-admin-label">Сабак аталышы</span>
                    <input
                      className="qa-admin-input"
                      value={lessonForm.title}
                      onChange={(e) => setLessonForm((prev) => ({ ...prev, title: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="qa-admin-field">
                    <span className="qa-admin-label">YouTube шилтемesi</span>
                    <input
                      className="qa-admin-input"
                      value={lessonForm.youtubeUrl}
                      onChange={(e) => setLessonForm((prev) => ({ ...prev, youtubeUrl: e.target.value }))}
                      placeholder="https://www.youtube.com/watch?v=..."
                      required
                    />
                  </label>
                  <div className="admin-course-form-row">
                    <label className="qa-admin-field">
                      <span className="qa-admin-label">№</span>
                      <input
                        className="qa-admin-input"
                        value={lessonForm.lessonOrder}
                        onChange={(e) => setLessonForm((prev) => ({ ...prev, lessonOrder: e.target.value }))}
                      />
                    </label>
                    <label className="qa-admin-field">
                      <span className="qa-admin-label">Узактыгы (мм:сс)</span>
                      <input
                        className="qa-admin-input"
                        value={lessonForm.duration}
                        onChange={(e) => setLessonForm((prev) => ({ ...prev, duration: e.target.value }))}
                        placeholder="10:15"
                      />
                    </label>
                  </div>
                  <label className="qa-admin-field">
                    <span className="qa-admin-label">Сүрөттөмө</span>
                    <textarea
                      className="qa-admin-textarea"
                      value={lessonForm.description}
                      onChange={(e) => setLessonForm((prev) => ({ ...prev, description: e.target.value }))}
                      rows={2}
                    />
                  </label>
                  <label className="qa-admin-field admin-course-checkbox">
                    <input
                      type="checkbox"
                      checked={lessonForm.isPublished}
                      onChange={(e) => setLessonForm((prev) => ({ ...prev, isPublished: e.target.checked }))}
                    />
                    <span>Жарыялоо</span>
                  </label>
                  <div className="qa-admin-form-actions">
                    <button type="submit" className="btn-gold qa-admin-btn" disabled={saving}>
                      {saving ? 'Сакталууда...' : 'Сактоо'}
                    </button>
                    <button type="button" className="qa-admin-btn qa-admin-btn-muted" onClick={closeLessonForm}>
                      Жокко чыгаруу
                    </button>
                  </div>
                </form>
              ) : null}

              {lessons.length === 0 ? (
                <p className="admin-user-empty">Сабактар жок. YouTube шилтемесин кошуңуз.</p>
              ) : (
                <ul className="admin-user-course-list">
                  {lessons.map((lesson) => (
                    <li key={lesson.id} className="admin-user-course-item">
                      <div>
                        <p className="admin-user-course-title">
                          №{lesson.lessonOrder} · {lesson.title}
                        </p>
                        <p className="admin-user-course-meta">
                          {formatCourseDuration(lesson.durationSeconds)} · {lesson.youtubeVideoId}
                        </p>
                        <button
                          type="button"
                          className={`admin-users-status ${
                            lesson.isPublished ? 'admin-users-status-active' : 'admin-users-status-blocked'
                          } admin-lesson-status-btn`}
                          onClick={() => void handleTogglePublish(lesson)}
                        >
                          {lesson.isPublished ? 'Жарыяланган' : 'Ж чертөө'}
                        </button>
                        <a
                          href={`https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-lesson-link"
                        >
                          YouTube ачуу
                        </a>
                      </div>
                      <div className="admin-lesson-actions">
                        <button
                          type="button"
                          className="qa-admin-btn qa-admin-btn-muted"
                          onClick={() => openEditLessonForm(lesson)}
                          aria-label="Редакциялоо"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="qa-admin-btn qa-admin-btn-danger"
                          onClick={() => void handleDeleteLesson(lesson)}
                          aria-label="Өчүрүү"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <div className="ui-card admin-placeholder-card">
            <p className="admin-placeholder-subtitle">Алгач курс маалыматын сактаңыз, андан кийин YouTube сабактарын кошо аласыз.</p>
          </div>
        )}
      </div>
    </section>
  );
}
