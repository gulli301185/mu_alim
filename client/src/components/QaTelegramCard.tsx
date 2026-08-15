import { Eye } from 'lucide-react';
import {
  formatQuestionDate,
  formatQuestionNumber,
  formatQuestionTime,
  formatViews,
} from '../lib/qa-format';
import type { QuestionArticle } from '../lib/qa-api';

type QaTelegramCardProps = {
  article: QuestionArticle;
  /** Тизmede кыскача көрсөтүү */
  compact?: boolean;
};

export function QaTelegramCard({ article, compact = false }: QaTelegramCardProps) {
  const question = article.question ?? article.title;
  const answer = article.answer ?? article.excerpt;
  const numberLabel =
    article.number != null ? `СУРОО ${formatQuestionNumber(article.number)}:` : 'СУРОО:';

  return (
    <div className="qa-tg-card">
      <p className="qa-tg-header">⚜️ СУРОО-ЖООП ⚜️</p>

      <div className="qa-tg-section">
        <p className="qa-tg-label">❓ {numberLabel}</p>
        <p className="qa-tg-text">{question}</p>
      </div>

      <div className="qa-tg-section">
        <p className="qa-tg-label">✅ ЖООП:</p>
        <p className={`qa-tg-text${compact ? ' qa-tg-text-compact' : ''}`}>{answer}</p>
      </div>

      <div className="qa-tg-footer">
        {article.tags && article.tags.length > 0 ? (
          <div className="qa-tg-tags">
            {article.tags.map((tag) => (
              <span key={tag} className="qa-article-tag">
                #{tag}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="qa-tg-meta">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          <span>{formatViews(article.views)}</span>
          <span className="qa-tg-meta-dot">·</span>
          <span>{formatQuestionDate(article.publishedAt)}</span>
          <span className="qa-tg-meta-dot">·</span>
          <span>{formatQuestionTime(article.publishedAt)}</span>
        </div>
      </div>
    </div>
  );
}
