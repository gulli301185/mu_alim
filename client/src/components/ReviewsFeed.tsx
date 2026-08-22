import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCourses } from '../lib/course-api';
import { fetchPublicReviews, type CourseReview } from '../lib/reviews-api';
import { ReviewCoverSlide, coverTitleForCourse } from './ReviewCarousel';
import { ReviewModal } from './ReviewModal';

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

  const rows = useMemo(() => {
    const bySlug = new Map<string, typeof items>();
    for (const item of items) {
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

    return result;
  }, [courses, items]);

  const loading = reviewsQuery.isLoading || coursesQuery.isLoading;

  return (
    <div id="reviews" className="otzyv-panel">
      {loading ? (
        <p className="otzyv-status">Жүктөлүүдө...</p>
      ) : (
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
