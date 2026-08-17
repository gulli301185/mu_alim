import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { QaPagination } from '../components/QaPagination';
import { QaTelegramCard } from '../components/QaTelegramCard';
import { QaAdminForm } from '../components/QaAdminForm';
import { useAuth } from '../context/AuthContext';
import { QUESTIONS_PER_PAGE, QUESTION_SORT_OPTIONS } from '../lib/qa-format';
import { highlightText } from '../lib/search-highlight';
import {
  createQaArticle,
  deleteQaArticle,
  fetchQaList,
  type QuestionArticle,
  type QuestionSort,
} from '../lib/qa-api';

const SORT_VALUES = new Set<QuestionSort>(['default', 'newest', 'oldest', 'popular']);

function parseSort(value: string | null): QuestionSort {
  return value && SORT_VALUES.has(value as QuestionSort) ? (value as QuestionSort) : 'default';
}

function QaAdminList({
  items,
  loading,
  error,
  onReload,
  onDelete,
  searchQuery = '',
}: {
  items: QuestionArticle[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onDelete: (article: QuestionArticle) => void;
  searchQuery?: string;
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
            <p className="qa-admin-row-text">
              {highlightText(article.question ?? article.title, searchQuery)}
            </p>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryInput, setQueryInput] = useState(() => searchParams.get('q') ?? '');
  const [items, setItems] = useState<QuestionArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const pageParam = searchParams.get('page');
  const page = Math.max(1, Number(pageParam) || 1);
  const sort = parseSort(searchParams.get('sort'));
  const query = searchParams.get('q') ?? '';

  const updateParams = useCallback(
    (patch: Record<string, string | null>, replace = true) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value == null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = queryInput.trim();
      if (trimmed === query) return;
      updateParams({ q: trimmed || null, page: '1' });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, queryInput, updateParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setItems([]);
    try {
      const data = await fetchQaList({
        page,
        limit: QUESTIONS_PER_PAGE,
        search: query,
        sort,
      });

      if (data.totalPages > 0 && page > data.totalPages) {
        updateParams({ page: String(data.totalPages) });
        return;
      }

      if (!pageParam && !query && sort === 'default' && data.totalPages > 1) {
        updateParams({ page: String(data.totalPages) });
        return;
      }

      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      setError('Маалымат базасынан жүктөө ийгиликсиз.');
    } finally {
      setLoading(false);
    }
  }, [page, pageParam, query, sort, updateParams]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page, sort, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (values: { question: string; answer: string; number?: number }) => {
    if (!token) throw new Error('Админ кирүү керек');
    await createQaArticle(token, values);
    setShowCreate(false);
    updateParams({ page: '1' });
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
  const sortLabel = useMemo(
    () => QUESTION_SORT_OPTIONS.find((option) => option.value === sort)?.label,
    [sort],
  );

  const listReturnSearch = searchParams.toString();

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
              placeholder="Издөө (сөз же №153)..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </label>

          <div className="qa-sort-row" role="group" aria-label="Сорттоо">
            {QUESTION_SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`qa-sort-btn${sort === option.value ? ' qa-sort-btn-active' : ''}`}
                onClick={() => updateParams({ sort: option.value, page: '1' })}
              >
                {option.label}
              </button>
            ))}
          </div>

          <QaAdminList
            items={items}
            loading={loading}
            error={error}
            onReload={() => void load()}
            onDelete={(article) => void handleDelete(article)}
            searchQuery={query}
          />

          {!loading && !error && (
            <QaPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(nextPage) => updateParams({ page: String(nextPage) })}
            />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="qa-page">
      <div className="wrap qa-page-wrap">
        <header className="qa-page-header">
          <div>
            <p className="qa-page-kicker">Жаңы бөлүм · 2025-жылдан тартып толукталат</p>
            <h1 className="qa-page-title">Суроо-жооп</h1>
            <p className="qa-page-subtitle">Диний суроолорго жооптор — Муалим академиясы</p>
          </div>
        </header>

        <div className="qa-toolbar ui-card">
          <label className="qa-search">
            <Search className="h-4 w-4 qa-search-icon" aria-hidden />
            <input
              type="search"
              className="qa-search-input"
              placeholder="Сөз же номер менен издөө (мисалы: 153)"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
            />
          </label>

          <div className="qa-sort-row" role="group" aria-label="Сорттоо">
            {QUESTION_SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`qa-sort-btn${sort === option.value ? ' qa-sort-btn-active' : ''}`}
                onClick={() => updateParams({ sort: option.value, page: '1' })}
              >
                {option.label}
              </button>
            ))}
          </div>
          {!loading && sort !== 'default' && sortLabel ? (
            <p className="qa-sort-note">
              Бардык {total} суроонун ичинен иреттелди · {sortLabel.toLowerCase()} · {currentPage}-бет
            </p>
          ) : null}
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
                  <Link
                    to={`/questions/${article.slug ?? article.id}`}
                    state={{ returnSearch: listReturnSearch }}
                    className="qa-tg-card-link"
                  >
                    <QaTelegramCard article={article} compact searchQuery={query} />
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

          {!loading && !error && (
            <QaPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(nextPage) => updateParams({ page: String(nextPage) })}
            />
          )}
        </div>
      </div>
    </section>
  );
}
