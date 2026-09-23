import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ThumbsUp } from 'lucide-react';
import { isVideoReview, type CourseReview } from '../lib/reviews-api';
import { ReviewPostCard } from './ReviewPostCard';
import { useSiteImages } from '../context/SiteImagesContext';
import { SITE_IMAGE_KEYS } from '../lib/site-images-api';

export function ReviewCoverSlide({ title }: { title: string }) {
  const { image } = useSiteImages();

  return (
    <article className="otzyv-cover">
      <img src={image(SITE_IMAGE_KEYS.reviewSky)} alt="" className="otzyv-cover-photo" />
      <img src={image(SITE_IMAGE_KEYS.reviewOyu)} alt="" className="otzyv-cover-oyu" />
      <div className="otzyv-cover-wash" />
      <div className="otzyv-cover-logos">
        <div className="otzyv-cover-brand">
          <img src={image(SITE_IMAGE_KEYS.logo)} alt="" />
        </div>
      </div>
      <div className="otzyv-cover-copy">
        <p className="otzyv-cover-title">“{title}”</p>
        <p className="otzyv-cover-tag">“ОТЗЫВДАР СҮЙЛӨСҮН”</p>
        <div className="otzyv-cover-bubbles" aria-hidden>
          <span className="otzyv-bubble otzyv-bubble-back">
            <i /><i /><i />
          </span>
          <span className="otzyv-bubble otzyv-bubble-front">
            <ThumbsUp className="otzyv-bubble-like" fill="currentColor" />
          </span>
        </div>
      </div>
    </article>
  );
}

function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return {
    onPointerDown: (event: PointerEvent) => {
      start.current = { x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event: PointerEvent) => {
      if (!start.current) return;
      const dx = event.clientX - start.current.x;
      const dy = event.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) onNext();
      else onPrev();
    },
  };
}

export function ReviewCarousel({
  title,
  items,
}: {
  title: string;
  items: CourseReview[];
}) {
  const textItems = items.filter((item) => !isVideoReview(item));
  const newestId = textItems[0]?.id ?? '';
  // Open on the first written review so text is visible immediately (cover is still reachable via prev).
  const [index, setIndex] = useState(() => (textItems.length > 0 ? 1 : 0));

  useEffect(() => {
    setIndex(textItems.length > 0 ? 1 : 0);
  }, [newestId, textItems.length]);

  const slides: ReactNode[] = [
    <ReviewCoverSlide key="cover" title={title} />,
    ...textItems.map((item) => <ReviewPostCard key={item.id} review={item} />),
  ];
  const last = slides.length - 1;

  const go = (dir: -1 | 1) => {
    setIndex((value) => Math.min(last, Math.max(0, value + dir)));
  };

  const swipe = useSwipe(() => go(-1), () => go(1));

  return (
    <div className="otzyv-stage" {...swipe}>
      {index > 0 ? (
        <button type="button" className="otzyv-arrow otzyv-arrow-prev" onClick={() => go(-1)} aria-label="Мурунку">
          <ChevronLeft className="h-5 w-5" />
        </button>
      ) : null}
      {slides[index]}
      {index < last ? (
        <button type="button" className="otzyv-arrow otzyv-arrow-next" onClick={() => go(1)} aria-label="Кийинки">
          <ChevronRight className="h-5 w-5" />
        </button>
      ) : null}
      {slides.length > 1 ? (
        <div className="otzyv-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`otzyv-dot${i === index ? ' otzyv-dot-active' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}-слайд`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const REVIEW_SERIES = [
  { slug: 'family', title: 'ҮЙ-БҮЛӨЛҮК БАКЫТ' },
  { slug: 'aqida', title: 'АКЫЙДА' },
] as const;

export function coverTitleForCourse(slug?: string, fallback?: string) {
  const known = REVIEW_SERIES.find((item) => item.slug === slug);
  if (known) return known.title;
  return (fallback || 'КУРС').trim().toUpperCase();
}
