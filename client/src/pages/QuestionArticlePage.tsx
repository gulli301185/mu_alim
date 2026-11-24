import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { QaTelegramCard } from '../components/QaTelegramCard';
import { QaAdminForm } from '../components/QaAdminForm';
import { useAuth } from '../context/AuthContext';
import {
  deleteQaArticle,
  fetchQaBySlug,
  recordQaView,
  updateQaArticle,
  type QuestionArticle,
} from '../lib/qa-api';
import { getErrorMessage, toastError } from '../lib/toast';

export function QuestionArticlePage({ adminMode = false }: { adminMode?: boolean }) {
  const { t: currentT, i18n } = useTranslation();
  const { articleId } = useParams<{ articleId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin, token, loading: authLoading } = useAuth();
  // The admin view stays Kyrgyz. Memoized: getFixedT() returns a new function each call.
  const t: TFunction = useMemo(
    () => (adminMode || isAdmin ? i18n.getFixedT('kg') : currentT),
    [adminMode, isAdmin, i18n, currentT],
  );
  // load() reads `t` through a ref so a language switch does not rerun it
  // (which would call recordQaView again and count the view twice).
  const tRef = useRef(t);
  tRef.current = t;
  const questionsBase = adminMode || isAdmin ? '/admin/questions' : '/questions';
  const [article, setArticle] = useState<QuestionArticle | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');

  const load = useCallback(async () => {
    if (!articleId) {
      setLoading(false);
      toastError(tRef.current('qa.questionNotFound'));
      setError('not-found');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchQaBySlug(articleId);
      setArticle(data);

      if (!authLoading && !isAdmin && !adminMode) {
        const viewResult = await recordQaView(articleId);
        if (viewResult) {
          setArticle((prev) => (prev ? { ...prev, views: viewResult.views } : prev));
        }
      }
    } catch {
      setArticle(undefined);
      toastError(tRef.current('qa.articleNotFoundInDb'));
      setError('not-found');
    } finally {
      setLoading(false);
    }
  }, [articleId, authLoading, isAdmin, adminMode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setEditing(searchParams.get('edit') === '1');
  }, [searchParams]);

  const handleUpdate = async (values: { question: string; answer: string; number?: number }) => {
    if (!token || !article?.recordId) throw new Error('Админ кирүү керек');
    const updated = await updateQaArticle(token, article.recordId, values);
    setArticle(updated);
    setEditing(false);
    if (updated.slug && updated.slug !== articleId) {
      navigate(`${questionsBase}/${updated.slug}`, { replace: true });
    }
  };

  const handleDelete = async () => {
    if (!token || !article?.recordId) return;
    const ok = window.confirm('Бул суроону өчүрөсүзбү?');
    if (!ok) return;
    try {
      await deleteQaArticle(token, article.recordId);
      navigate(questionsBase);
    } catch (err) {
      toastError(getErrorMessage(err, 'Өчүрүү ийгиликсиз'));
    }
  };

  const listReturnSearch =
    (location.state as { returnSearch?: string } | null)?.returnSearch ??
    searchParams.get('return') ??
    '';

  const backToQuestions = () => {
    navigate(listReturnSearch ? `${questionsBase}?${listReturnSearch}` : questionsBase);
  };

  if (loading) {
    return (
      <section className="qa-page qa-page-admin">
        <div className="wrap qa-page-wrap">
          <div className="qa-empty ui-card">
            <p>{t('common.loading')}</p>
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
            <p>{t('qa.articleNotFound')}</p>
            <Link to={questionsBase} className="btn-gold qa-admin-btn">
              {t('qa.back')}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (adminMode || isAdmin) {
    return (
      <section className="qa-page qa-page-admin">
        <div className="wrap qa-article-page-wrap">
          <button type="button" className="qa-admin-back" onClick={backToQuestions}>
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
        <button type="button" className="course-learn-back" onClick={backToQuestions}>
          <ArrowLeft className="h-4 w-4" />
          {t('qa.backToList')}
        </button>

        <QaTelegramCard article={article} />
      </div>
    </section>
  );
}
