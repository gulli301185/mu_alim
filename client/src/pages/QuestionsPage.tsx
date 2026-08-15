import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { QaTelegramCard } from '../components/QaTelegramCard';
import { QaAdminForm } from '../components/QaAdminForm';
import { useAuth } from '../context/AuthContext';
import { QUESTIONS_PER_PAGE, QUESTION_SORT_OPTIONS } from '../lib/qa-format';
import {
  createQaArticle,
  deleteQaArticle,
  fetchQaList,
  type QuestionArticle,
  type QuestionSort,
} from '../lib/qa-api';

function QaAdminList({
  items,
  loading,
  error,
  onReload,
  onDelete,
}: {
  items: QuestionArticle[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onDelete: (article: QuestionArticle) => void;
}) {
  if (error) {
    return (
      <div className="qa-empty ui-card">
        <p>{error}</p>
        <button type="button" className="btn-gold qa-admin-btn" onClick={onReload}>
          Кайра жүктөө
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="qa-empty ui-card">
        <p>Жүктөлүүдө...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="qa-empty ui-card">
        <p>Эч нерсе жок.</p>
      </div>
    );
  }

  return (
    <ul className="qa-admin-list">
      {items.map((article) => (
        <li key={article.recordId ?? article.slug ?? article.id} className="qa-admin-row ui-card">
          <div className="qa-admin-row-main">
            <span className="qa-admin-row-num">{article.number ?? '—'}</span>
            <p className="qa-admin-row-text">{article.question ?? article.title}</p>
          </div>
          <div className="qa-admin-row-actions">
            <Link to={`/questions/${article.slug ?? article.id}`} className="qa-admin-btn qa-admin-btn-muted">
              Көрүү
            </Link>
            <Link
              to={`/questions/${article.slug ?? article.id}?edit=1`}
              className="qa-admin-btn qa-admin-btn-muted"
            >
              Өзгөртүү
            </Link>
            <button
              type="button"
              className="qa-admin-btn qa-admin-btn-danger"
              onClick={() => onDelete(article)}
            >
              Өчүрүү
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function QuestionsPage() {
  const { isAdmin, token } = useAuth();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<QuestionSort>('default');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<QuestionArticle[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQaList({
        page,
        limit: QUESTIONS_PER_PAGE,
        search: query,
        sort: isAdmin ? 'default' : sort,
      });
      setItems(data.items);
      setTotalPages(data.totalPages);
    } catch {
      setItems([]);
      setTotalPages(1);
      setError('Маалымат базасынан жүктөө ийгиликсиз.');
    } finally {
      setLoading(false);
    }
  }, [page, query, sort, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (values: { question: string; answer: string; number?: number }) => {
    if (!token) throw new Error('Admin кирүү кerek');
    await createQaArticle(token, values);
    setShowCreate(false);
    setPage(1);
    await load();
  };

  const handleDelete = async (article: QuestionArticle) => {
    if (!token || !article.recordId) return;
    const ok = window.confirm('Бул суроону өчүрөсүзбү?');
    if (!ok) return;
    try {
      await deleteQaArticle(token, article.recordId);
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Өчүрүү ийгиликсиз');
    }
  };

  const currentPage = Math.min(page, totalPages);

  if (isAdmin) {
    return (
      <section className="qa-page qa-page-admin">
        <div className="wrap qa-page-wrap">
          <header className="qa-admin-header">
            <h1 className="qa-admin-title">Суроо-жооп</h1>
            <button
              type="button"
              className="btn-gold qa-admin-btn qa-admin-btn-add"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Plus className="h-5 w-5" />
              {showCreate ? 'Жабуу' : 'Жаңы суроо'}
            </button>
          </header>

          {showCreate ? (
            <QaAdminForm
              submitLabel="Сактоо"
              onCancel={() => setShowCreate(false)}
              onSubmit={handleCreate}
            />
          ) : null}

          <label className="qa-admin-search">
            <Search className="h-5 w-5" aria-hidden />
            <input
              type="search"
              className="qa-admin-search-input"
              placeholder="Издөө..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>

          <QaAdminList
            items={items}
            loading={loading}
            error={error}
            onReload={() => void load()}
            onDelete={(article) => void handleDelete(article)}
          />

          {!loading && !error && totalPages > 1 ? (
            <nav className="qa-pagination" aria-label="Беттер">
              <button
                type="button"
                className="qa-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="qa-admin-page-label">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="qa-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="qa-page">
      <div className="wrap qa-page-wrap">
        <header className="qa-page-header">
          <div>
            <p className="qa-page-kicker">Жаңы бөлüm · 2025-жылдан тартып толукталат</p>
            <h1 className="qa-page-title">Суроо-жооп</h1>
            <p className="qa-page-subtitle">Динiy суроолорго жооптор — Mualim Academy</p>
          </div>
        </header>

        <div className="qa-toolbar ui-card">
          <label className="qa-search">
            <Search className="h-4 w-4 qa-search-icon" aria-hidden />
            <input
              type="search"
              className="qa-search-input"
              placeholder="Материалдарды издөө..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>

          <div className="qa-sort-row" role="group" aria-label="Сорттоо">
            {QUESTION_SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`qa-sort-btn${sort === option.value ? ' qa-sort-btn-active' : ''}`}
                onClick={() => {
                  setSort(option.value);
                  setPage(1);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="qa-empty ui-card">
            <p>{error}</p>
            <button type="button" className="btn-primary qa-back-btn" onClick={() => void load()}>
              Кайра аракет кылуу
            </button>
          </div>
        ) : null}

        <div className="qa-main">
          {loading ? (
            <div className="qa-empty ui-card">
              <p>Жүктөлүүдө...</p>
            </div>
          ) : (
            <ul className="qa-articles">
              {items.map((article) => (
                <li key={article.slug ?? article.id}>
                  <Link to={`/questions/${article.slug ?? article.id}`} className="qa-tg-card-link">
                    <QaTelegramCard article={article} compact />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="qa-empty ui-card">
              <p>Эч нерсе табылган жок.</p>
            </div>
          )}

          {!loading && !error && totalPages > 1 && (
            <nav className="qa-pagination" aria-label="Беттер">
              <button
                type="button"
                className="qa-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`qa-page-num${n === currentPage ? ' qa-page-num-active' : ''}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="qa-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
