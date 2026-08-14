import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { QaTelegramCard } from '../components/QaTelegramCard';
import { getFallbackQuestionById, type QuestionArticle } from '../data/questions';
import { fetchQaBySlug } from '../lib/qa-api';

export function QuestionArticlePage() {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<QuestionArticle | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!articleId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const data = await fetchQaBySlug(articleId!);
        if (!cancelled) setArticle(data);
      } catch {
        if (!cancelled) setArticle(getFallbackQuestionById(articleId!));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  if (loading) {
    return (
      <section className="qa-page">
        <div className="wrap qa-page-wrap">
          <div className="qa-empty ui-card">
            <p>Жүктөлүүдө...</p>
          </div>
        </div>
      </section>
    );
  }

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

  const isTelegram = article.source === 'telegram' || (article.question && article.answer);

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

        {isTelegram ? (
          <QaTelegramCard article={article} />
        ) : (
          <article className="qa-article-detail ui-card">
            <h1 className="qa-article-detail-title">{article.title}</h1>
            <div className="qa-article-detail-body">
              <p>{article.excerpt}</p>
              <p>
                Толук макала жакында жарыяланат. Ушул убакта сурооңуз болсо,{' '}
                <a href="mailto:info@mualim.academy">info@mualim.academy</a> дарегине жазыңыз.
              </p>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
