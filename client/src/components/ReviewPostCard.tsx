import { Star } from 'lucide-react';
import type { CourseReview } from '../lib/reviews-api';

export function ReviewPostCard({ review }: { review: CourseReview }) {
  return (
    <article className="otzyv-card">
      <img src="/review-flowers.jpg" alt="" className="otzyv-bg" />
      <div className="otzyv-sheet">
        <div className="otzyv-logo-badge">
          <img src="/logo-mualim.png" alt="" className="otzyv-logo" />
        </div>
        <div className="otzyv-stars" aria-label={`${review.rating} жылдыз`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className="otzyv-star"
              fill={i < review.rating ? 'currentColor' : 'none'}
              strokeWidth={1.4}
            />
          ))}
        </div>
        <p className={`otzyv-text${review.comment ? '' : ' otzyv-text-empty'}`}>
          {review.comment || 'Текст жок'}
        </p>
        {review.authorName ? (
          <p className="otzyv-author">— {review.authorName}</p>
        ) : null}
      </div>
    </article>
  );
}
