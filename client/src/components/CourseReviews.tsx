import { useEffect, useState, type FormEvent } from 'react';
import { Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import {
  fetchCourseReviews,
  submitCourseReview,
  type CourseReview,
} from '../lib/reviews-api';
import { ReviewCarousel, coverTitleForCourse } from './ReviewCarousel';
import { getErrorMessage, toastError, toastSuccess } from '../lib/toast';

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange?: (value: number) => void;
}) {
  return (
    <span className="course-review-stars">
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < value;
        const icon = (
          <Star
            className={`course-review-star${filled ? ' course-review-star-filled' : ''}`}
            fill={filled ? 'currentColor' : 'none'}
            strokeWidth={1.8}
          />
        );
        if (!onChange) return <span key={i}>{icon}</span>;
        return (
          <button
            key={i}
            type="button"
            className="course-review-star-btn"
            onClick={() => onChange(i + 1)}
            aria-label={`${i + 1} жылдыз`}
          >
            {icon}
          </button>
        );
      })}
    </span>
  );
}

export function CourseReviewsSection({
  courseRef,
  courseTitle,
  courseSlug,
  hideCards = false,
}: {
  courseRef: string;
  courseTitle?: string;
  courseSlug?: string;
  hideCards?: boolean;
}) {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<CourseReview[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchCourseReviews(courseRef, { limit: 20, token });
      setItems(data.items);
      setAverageRating(data.averageRating);
      setRatingsCount(data.ratingsCount);
      setDisplayName((current) => {
        if (current.trim()) return current;
        if (user) return `${user.firstName} ${user.lastName}`.trim();
        return '';
      });
    } catch (err) {
      toastError(getErrorMessage(err, 'Пикирлер жүктөлгөн жок'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseRef, token]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const result = await submitCourseReview(token, courseRef, {
        rating,
        comment: comment.trim() || undefined,
        displayName: displayName.trim() || undefined,
      });
      toastSuccess(result.message);
      await queryClient.invalidateQueries({ queryKey: ['public-reviews'] });
      await load();
      setComment('');
      setRating(0);
    } catch (err) {
      toastError(getErrorMessage(err, 'Пикир сакталган жок'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="course-reviews ui-card">
      <div className="course-reviews-head">
        <h2 className="course-reviews-title">Пикирлер</h2>
        <p className="course-reviews-avg">
          {ratingsCount > 0 ? `${averageRating} / 5 · ${ratingsCount} пикир` : 'Азырынча пикир жок'}
        </p>
      </div>

      {user ? (
        <form className="course-review-form" onSubmit={(event) => void onSubmit(event)}>
          <p className="course-review-form-label">Сиздин бааңыз</p>
          <Stars value={rating} onChange={setRating} />
          <label className="course-review-form-label" htmlFor="course-review-name">
            Отзыв жазган адам
          </label>
          <input
            id="course-review-name"
            className="course-review-input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Атыңыз"
            maxLength={150}
            required
          />
          <label className="course-review-form-label" htmlFor="course-review-text">
            Отзыв тексти
          </label>
          <textarea
            id="course-review-text"
            className="course-review-textarea"
            rows={8}
            maxLength={8000}
            placeholder="Пикириңизди жазыңыз"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={saving || !displayName.trim() || rating < 1}>
            {saving ? 'Жөнөтүлүүдө...' : 'Пикир калтыруу'}
          </button>
        </form>
      ) : (
        <p className="course-review-note">Пикир калтыруу үчүн аккаунтка кириңиз.</p>
      )}

      {hideCards ? null : loading ? (
        <p className="course-review-note">Жүктөлүүдө...</p>
      ) : (
        <div className="ig-reviews-list">
          <ReviewCarousel
            title={coverTitleForCourse(
              items[0]?.courseSlug || courseSlug || courseRef,
              items[0]?.courseTitle || courseTitle,
            )}
            items={items}
          />
        </div>
      )}
    </section>
  );
}
