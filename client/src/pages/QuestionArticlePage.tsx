import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, FileText, Play } from 'lucide-react';
import {
  formatQuestionDate,
  formatViews,
  getQuestionById,
} from '../data/questions';

export function QuestionArticlePage() {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const article = articleId ? getQuestionById(articleId) : undefined;

  if (!article) {
    return (
      <section className="qa-page">
        <div className="wrap qa-page-wrap">
          <div className="qa-empty ui-card">
            <p>Макала табылган жок.</p>
            <Link to="/questions" className="btn-primary qa-back-btn">
              Суроо-жоопко кайтуу
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="qa-page">
      <div className="wrap qa-article-page-wrap">
        <button
          type="button"
          className="course-learn-back"
          onClick={() => navigate('/questions')}
        >
          <ArrowLeft className="h-4 w-4" />
          Суроо-жоопко кайтуу
        </button>

        <article className="qa-article-detail ui-card">
          <span className={`qa-article-badge${article.type === 'video' ? ' qa-article-badge-video' : ''}`}>
            {article.type === 'video' ? (
              <>
                <Play className="h-3.5 w-3.5" aria-hidden />
                Видео макала
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Тексттик макала
              </>
            )}
          </span>

          <h1 className="qa-article-detail-title">{article.title}</h1>

          <div className="qa-article-detail-meta">
            <span>{formatQuestionDate(article.publishedAt)}</span>
            <span className="qa-article-views">
              <Eye className="h-4 w-4" aria-hidden />
              {formatViews(article.views)}
            </span>
          </div>

          <div className="qa-article-detail-body">
            <p>{article.excerpt}</p>
            <p>
              Толук макала жакында жарыяланат. Ушул убакта сурооңуз болсо,{' '}
              <a href="mailto:info@mualim.academy">info@mualim.academy</a> дарегине жазыңыз.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
