import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { QaTelegramCard } from '../components/QaTelegramCard';
import { QaAdminForm } from '../components/QaAdminForm';
import { useAuth } from '../context/AuthContext';
import {
  deleteQaArticle,
  fetchQaBySlug,
  updateQaArticle,
  type QuestionArticle,
} from '../lib/qa-api';

export function QuestionArticlePage() {
  const { articleId } = useParams<{ articleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin, token } = useAuth();
  const [article, setArticle] = useState<QuestionArticle | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');

  const load = useCallback(async () => {
    if (!articleId) {
      setLoading(false);
      setError('Суроо табылган жок.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchQaBySlug(articleId);
      setArticle(data);
    } catch {
      setArticle(undefined);
      setError('Макала базадан табылган жок.');
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEditing(searchParams.get('edit') === '1');
  }, [searchParams]);

  const handleUpdate = async (values: { question: string; answer: string; number?: number }) => {
    if (!token || !article?.recordId) throw new Error('Admin кирүү кerek');
    const updated = await updateQaArticle(token, article.recordId, values);
    setArticle(updated);
    setEditing(false);
    if (updated.slug && updated.slug !== articleId) {
      navigate(`/questions/${updated.slug}`, { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!token || !article?.recordId) return;
    const ok = window.confirm('Бул суроону өчүрөсүзбү?');
    if (!ok) return;
    try {
      await deleteQaArticle(token, article.recordId);
      navigate('/questions');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Өчүрүү ийгиликсиз');
    }
  };

  if (loading) {
    return (
      <section className="qa-page qa-page-admin">
        <div className="wrap qa-page-wrap">
          <div className="qa-empty ui-card">
            <p>Жүктөлүүдө...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !article) {
    return (
      <section className="qa-page qa-page-admin">
        <div className="wrap qa-page-wrap">
          <div className="qa-empty ui-card">
            <p>{error ?? 'Макала табылган жок.'}</p>
            <Link to="/questions" className="btn-gold qa-admin-btn">
              Артка
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (isAdmin) {
    return (
      <section className="qa-page qa-page-admin">
        <div className="wrap qa-article-page-wrap">
          <button type="button" className="qa-admin-back" onClick={() => navigate('/questions')}>
            <ArrowLeft className="h-5 w-5" />
            Артка
          </button>

          {!editing ? (
            <>
              <div className="qa-admin-view ui-card">
                <p className="qa-admin-view-label">Суроо №{article.number ?? '—'}</p>
                <h1 className="qa-admin-view-question">{article.question ?? article.title}</h1>
                <p className="qa-admin-view-label">Жооп</p>
                <p className="qa-admin-view-answer">{article.answer}</p>
              </div>

              <div className="qa-admin-article-actions">
                <button type="button" className="qa-admin-btn qa-admin-btn-muted" onClick={() => setEditing(true)}>
                  Өзгөртүү
                </button>
                <button type="button" className="qa-admin-btn qa-admin-btn-danger" onClick={() => void handleDelete()}>
                  Өчүрүү
                </button>
              </div>
            </>
          ) : (
            <QaAdminForm
              initial={{
                question: article.question ?? article.title,
                answer: article.answer ?? '',
                number: article.number ?? undefined,
              }}
              submitLabel="Сактоо"
              onCancel={() => setEditing(false)}
              onSubmit={handleUpdate}
            />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="qa-page">
      <div className="wrap qa-article-page-wrap">
        <button type="button" className="course-learn-back" onClick={() => navigate('/questions')}>
          <ArrowLeft className="h-4 w-4" />
          Суроо-жоопко кайтуу
        </button>

        <QaTelegramCard article={article} />
      </div>
    </section>
  );
}
