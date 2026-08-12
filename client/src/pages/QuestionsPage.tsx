import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Eye, FileText, Play, Search } from 'lucide-react';
import { AYAH, FREE_VIDEOS, HADITH } from '../data/landing';
import {
  filterQuestions,
  formatQuestionDate,
  formatViews,
  QUESTION_ARTICLES,
  QUESTIONS_PER_PAGE,
  QUESTION_SORT_OPTIONS,
  sortQuestions,
  type QuestionSort,
} from '../data/questions';

function ArticleTypeBadge({ type }: { type: 'text' | 'video' }) {
  if (type === 'video') {
    return (
      <span className="qa-article-badge qa-article-badge-video">
        <Play className="h-3.5 w-3.5" aria-hidden />
        Видео макала
      </span>
    );
  }
  return (
    <span className="qa-article-badge">
      <FileText className="h-3.5 w-3.5" aria-hidden />
      Тексттик макала
    </span>
  );
}

export function QuestionsPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<QuestionSort>('default');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const sorted = sortQuestions(filterQuestions(QUESTION_ARTICLES, query), sort);
    return sorted;
  }, [query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / QUESTIONS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * QUESTIONS_PER_PAGE,
    currentPage * QUESTIONS_PER_PAGE,
  );

  const newMaterials = FREE_VIDEOS.slice(0, 3);

  return (
    <section className="qa-page">
      <div className="wrap qa-page-wrap">
        <header className="qa-page-header">
          <div>
            <p className="qa-page-kicker">Жаңы бөлüm · 2025-жылдан тартып толукталат</p>
            <h1 className="qa-page-title">Суроо-жооп</h1>
            <p className="qa-page-subtitle">
              Динiy суроолорго жооптор, макалалар жана видеолор — Mualim Academy
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

          <label className="qa-sort">
            <span className="qa-sort-label">Сорттоо</span>
            <select
              className="qa-sort-select"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as QuestionSort);
                setPage(1);
              }}
            >
              {QUESTION_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="qa-layout">
          <div className="qa-main">
            <ul className="qa-articles">
              {pageItems.map((article) => (
                <li key={article.id}>
                  <Link to={`/questions/${article.id}`} className="qa-article-card ui-card">
                    <ArticleTypeBadge type={article.type} />
                    <h2 className="qa-article-title">{article.title}</h2>
                    <p className="qa-article-excerpt">{article.excerpt}</p>
                    <p className="qa-article-views">
                      <Eye className="h-4 w-4" aria-hidden />
                      <span>Көрүүлөр: {formatViews(article.views)}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>

            {pageItems.length === 0 && (
              <div className="qa-empty ui-card">
                <p>Эч нерсе табылган жок. Башка сөз менен издеп көрүңүз.</p>
              </div>
            )}

            {totalPages > 1 && (
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

          <aside className="qa-sidebar">
            <div className="qa-sidebar-card qa-sidebar-ayah ui-card">
              <h2 className="qa-sidebar-title">Күндүн аяты</h2>
              <p className="qa-sidebar-text">{AYAH.translation}</p>
              <p className="qa-sidebar-source">— {AYAH.source}</p>
              <Link to="/#ayah" className="qa-sidebar-link">
                Толук окуу
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="qa-sidebar-card qa-sidebar-hadith ui-card">
              <h2 className="qa-sidebar-title">Күндүн хадиси</h2>
              <p className="qa-sidebar-text">{HADITH.text}</p>
              <p className="qa-sidebar-source">— {HADITH.source}</p>
              <Link to="/#hadith" className="qa-sidebar-link">
                Толук окуу
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="qa-sidebar-card ui-card">
              <h2 className="qa-sidebar-title">Жаңы материалдар</h2>
              <ul className="qa-new-list">
                {newMaterials.map((video) => (
                  <li key={video.id + video.date}>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="qa-new-item"
                    >
                      <span className="qa-new-type">
                        <Play className="h-3 w-3" aria-hidden />
                        Видео
                      </span>
                      <span className="qa-new-title">{video.title}</span>
                      <span className="qa-new-date">{formatQuestionDate(video.date)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
