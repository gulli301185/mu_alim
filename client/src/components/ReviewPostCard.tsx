import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { CourseReview } from '../lib/reviews-api';
import { useSiteImages } from '../context/SiteImagesContext';
import { SITE_IMAGE_KEYS } from '../lib/site-images-api';
import { assetUrl } from '../lib/asset-url';

function reviewVideoSrc(path: string | undefined | null) {
  if (!path) return '';
  if (path.includes('family-img-2047')) {
    return assetUrl('/uploads/reviews/family-2047.mp4?v=small');
  }
  return assetUrl(path);
}

function reviewVideoPoster(path: string | undefined | null) {
  if (!path) return undefined;
  const resolved = path.includes('family-img-2047')
    ? '/uploads/reviews/family-2047.mp4'
    : path.split('?')[0];
  if (!resolved.endsWith('.mp4')) return undefined;
  return assetUrl(resolved.replace(/\.mp4$/, '-poster.jpg'));
}

function pauseOtherVideos(current: HTMLVideoElement) {
  document.querySelectorAll<HTMLVideoElement>('.otzyv-video').forEach((video) => {
    if (video !== current) video.pause();
  });
}

export function ReviewPostCard({ review }: { review: CourseReview }) {
  const { image } = useSiteImages();
  const videoSrc = reviewVideoSrc(review.videoUrl);
  const videoPoster = reviewVideoPoster(review.videoUrl);

  if (videoSrc) {
    return (
      <article className="otzyv-card otzyv-card-video">
        <img src={image(SITE_IMAGE_KEYS.reviewFlowers)} alt="" className="otzyv-bg" />
        <video
          className="otzyv-video"
          src={videoSrc}
          poster={videoPoster}
          controls
          playsInline
          preload="metadata"
          onPlay={(event) => pauseOtherVideos(event.currentTarget)}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        />
      </article>
    );
  }

  return (
    <article className="otzyv-card">
      <img src={image(SITE_IMAGE_KEYS.reviewFlowers)} alt="" className="otzyv-bg" />
      <div className="otzyv-sheet">
        <div className="otzyv-logo-badge">
          <img src={image(SITE_IMAGE_KEYS.logo)} alt="" className="otzyv-logo" />
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

function videoSortKey(url: string) {
  if (url.includes('family-2047') || url.includes('family-img-2047')) return 0;
  if (url.includes('family-otzyv.mp4') || url.includes('family-otzyv-')) return 1;
  const match = url.match(/family-otz(\d+)/);
  if (match) return 10 + Number(match[1]);
  return 100;
}

function videoSeriesKey(review: CourseReview) {
  const url = review.videoUrl || '';
  if (url.includes('family-2047') || url.includes('family-img-2047') || url.includes('family-otzyv')) {
    return 'series:family-interview';
  }
  const match = url.match(/family-otz(\d+)/);
  if (match) return `series:otz-${match[1]}`;
  return `id:${review.id}`;
}

export function groupVideoReviews(items: CourseReview[]) {
  const groups = new Map<string, CourseReview[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = videoSeriesKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }

  return order.map((key) =>
    groups
      .get(key)!
      .slice()
      .sort((a, b) => {
        const byClip = videoSortKey(a.videoUrl || '') - videoSortKey(b.videoUrl || '');
        if (byClip !== 0) return byClip;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }),
  ).sort((a, b) => videoSortKey(a[0]?.videoUrl || '') - videoSortKey(b[0]?.videoUrl || ''));
}

export function VideoReviewStack({ clips }: { clips: CourseReview[] }) {
  const [index, setIndex] = useState(0);
  const last = clips.length - 1;
  const current = clips[Math.min(index, last)];

  useEffect(() => {
    setIndex(0);
  }, [clips[0]?.id, clips.length]);

  if (!current) return null;

  const go = (dir: -1 | 1) => {
    document.querySelectorAll<HTMLVideoElement>('.otzyv-video').forEach((video) => video.pause());
    setIndex((value) => Math.min(last, Math.max(0, value + dir)));
  };

  return (
    <div className={`otzyv-video-stack${clips.length > 1 ? ' otzyv-video-stack-layered' : ''}`}>
      {clips.length > 1 ? <div className="otzyv-video-stack-back" aria-hidden /> : null}
      <div className="otzyv-stage otzyv-video-stack-front">
        <ReviewPostCard key={current.id} review={current} />
        {index > 0 ? (
          <button
            type="button"
            className="otzyv-arrow otzyv-arrow-prev"
            onClick={() => go(-1)}
            aria-label="Мурунку"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        {index < last ? (
          <button
            type="button"
            className="otzyv-arrow otzyv-arrow-next"
            onClick={() => go(1)}
            aria-label="Кийинки"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : null}
        {clips.length > 1 ? (
          <p className="otzyv-video-stack-count">
            {index + 1} / {clips.length}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function VideoReviewFeed({ items }: { items: CourseReview[] }) {
  const groups = groupVideoReviews(items);
  if (!groups.length) return null;

  return (
    <div className="otzyv-video-feed">
      <p className="otzyv-video-feed-title">Видео отзывдар</p>
      <div className="otzyv-video-feed-row">
        {groups.map((clips) => (
          <div key={clips[0].id} className="otzyv-video-feed-item">
            <VideoReviewStack clips={clips} />
          </div>
        ))}
      </div>
    </div>
  );
}
