import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { CourseReview } from '../lib/reviews-api';
import { ReviewCarousel } from './ReviewCarousel';

export function ReviewModal({
  title,
  items,
  onClose,
}: {
  title: string;
  items: CourseReview[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="auth-modal-overlay otzyv-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="otzyv-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="auth-modal-close otzyv-modal-close" onClick={onClose} aria-label="Жабуу">
          <X className="h-5 w-5" />
        </button>
        <ReviewCarousel title={title} items={items} />
      </div>
    </div>
  );
}
