import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCourses } from '../lib/course-api';
import { fetchPublicReviews, isVideoReview, type CourseReview } from '../lib/reviews-api';
import { ReviewCoverSlide, coverTitleForCourse } from './ReviewCarousel';
import { ReviewModal } from './ReviewModal';
import { VideoReviewFeed } from './ReviewPostCard';

type ReviewRow = {
  slug: string;
  title: string;
  items: CourseReview[];
};

export function ReviewsFeed() {
  const reviewsQuery = useQuery({
    queryKey: ['public-reviews'],
    queryFn: () => fetchPublicReviews({ page: 1, limit: 200 }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const coursesQuery = useQuery({
    queryKey: ['paid-courses-reviews'],
    queryFn: () => fetchCourses({ type: 'paid', limit: 50 }),
  });

  const [openRow, setOpenRow] = useState<ReviewRow | null>(null);
  const items = reviewsQuery.data?.items ?? [];
  const courses = coursesQuery.data?.items ?? [];

  const { rows, videoItems } = useMemo(() => {
    const textItems = items.filter((item) => !isVideoReview(item));
    const videos = items.filter(isVideoReview);
    const bySlug = new Map<string, typeof textItems>();
    for (const item of textItems) {
      const slug = item.courseSlug || 'other';
      const list = bySlug.get(slug) ?? [];
      list.push(item);
      bySlug.set(slug, list);
    }

    const seen = new Set<string>();
    const result: ReviewRow[] = [];

    for (const course of courses) {
      seen.add(course.slug);
      result.push({
        slug: course.slug,
        title: coverTitleForCourse(course.slug, course.title),
        items: bySlug.get(course.slug) ?? [],
      });
    }

    for (const [slug, list] of bySlug) {
      if (seen.has(slug)) continue;
      result.push({
        slug,
        title: coverTitleForCourse(slug, list[0]?.courseTitle),
        items: list,
      });
    }

    return { rows: result, videoItems: videos };
  }, [courses, items]);

  const loading = reviewsQuery.isLoading || coursesQuery.isLoading;

  return (
    <div id="reviews" className="otzyv-panel">
      {loading ? (
        <p className="otzyv-status">Жүктөлүүдө...</p>
      ) : (
        <>
          <div className="otzyv-stack">
            {rows.map((row) => (
              <button
                key={row.slug}
                type="button"
                className="otzyv-stage otzyv-card-open"
                onClick={() => setOpenRow(row)}
              >
                <ReviewCoverSlide title={row.title} />
              </button>
            ))}
          </div>
          {videoItems.length > 0 ? <VideoReviewFeed items={videoItems} /> : null}
        </>
      )}
      {openRow ? (
        <ReviewModal
          title={openRow.title}
          items={openRow.items}
          onClose={() => setOpenRow(null)}
        />
      ) : null}
    </div>
  );
}
