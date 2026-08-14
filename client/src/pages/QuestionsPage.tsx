import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { QaTelegramCard } from '../components/QaTelegramCard';
import {
  FALLBACK_QUESTIONS,
  filterQuestions,
  QUESTIONS_PER_PAGE,
  QUESTION_SORT_OPTIONS,
  sortQuestions,
  type QuestionArticle,
  type QuestionSort,
} from '../data/questions';
import { fetchQaList } from '../lib/qa-api';

export function QuestionsPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<QuestionSort>('default');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<QuestionArticle[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchQaList({
          page,
          limit: QUESTIONS_PER_PAGE,
          search: query,
          sort,
        });
        if (cancelled) return;
        setItems(data.items);
        setTotalPages(data.totalPages);
        setUseFallback(false);
      } catch {
        if (cancelled) return;
        const filtered = sortQuestions(filterQuestions(FALLBACK_QUESTIONS, query), sort);
        setItems(
          filtered.slice((page - 1) * QUESTIONS_PER_PAGE, page * QUESTIONS_PER_PAGE),
        );
        setTotalPages(Math.max(1, Math.ceil(filtered.length / QUESTIONS_PER_PAGE)));
        setUseFallback(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [page, query, sort]);

  const currentPage = Math.min(page, totalPages);

  return (
    <section className="qa-page">
      <div className="wrap qa-page-wrap">
        <header className="qa-page-header">
          <div>
            <p className="qa-page-kicker">Жаңы бөлüm · 2025-жылдан тартып толукталат</p>
            <h1 className="qa-page-title">Суроо-жооп</h1>
            <p className="qa-page-subtitle">
              Динiy суроолорго жооптор — Mualim Academy
            </p>
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

        {useFallback ? (
          <p className="qa-fallback-note">API иштебей жатат — статикалык маалымат көрсөтүлүүдө.</p>
        ) : null}

        <div className="qa-main">
          {loading ? (
            <div className="qa-empty ui-card">
              <p>Жүктөлүүдө...</p>
            </div>
          ) : (
            <ul className="qa-articles">
              {items.map((article, index) => (
                <li key={article.id}>
                  <Link to={`/questions/${article.id}`} className="qa-tg-card-link">
                    <QaTelegramCard
                      article={{
                        ...article,
                        number:
                          sort === 'default'
                            ? (page - 1) * QUESTIONS_PER_PAGE + index + 1
                            : article.number,
                      }}
                      compact
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!loading && items.length === 0 && (
            <div className="qa-empty ui-card">
              <p>Эч нерсе табылган жок. Башка сөз менен издеп көрүңүз.</p>
            </div>
          )}

          {!loading && totalPages > 1 && (
            <nav className="qa-pagination" aria-label="Беттер">
              <button
                type="button"
                className="qa-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Мурдагы бет"
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
                aria-label="Кийинки бет"
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
