import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Play, Star } from 'lucide-react';
import { PAID_COURSES } from '../data/landing';
import { getCourseById } from '../data/courseLessons';
import { isCoursePaid, loadPaidCourses } from '../lib/courseAccess';
import { youtubeThumbnail } from '../lib/youtube';
import { CoursePaymentBlock } from './CoursesPage';

function StarRating({ value, compact = false }: { value: number; compact?: boolean }) {
  return (
    <span
      className={`course-stars${compact ? ' course-stars-compact' : ''}`}
      aria-label={`${value} из 5`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`course-star ${i < Math.round(value) ? 'course-star-filled' : ''}`}
          fill={i < Math.round(value) ? 'currentColor' : 'none'}
          strokeWidth={1.75}
        />
      ))}
      <span className="course-rating-num">{value}</span>
    </span>
  );
}

function CoursesSidebar({ activeCourseId }: { activeCourseId: string }) {
  const paidCourseIds = loadPaidCourses();

  return (
    <aside className="courses-sidebar ui-card">
      <h2 className="courses-sidebar-title">
        <BookOpen className="h-5 w-5" aria-hidden />
        Бардык курстар
      </h2>
      <ul className="courses-sidebar-list">
        {PAID_COURSES.map((course) => (
          <li key={course.id}>
            <NavLink
              to={`/courses/${course.id}`}
              className={({ isActive }) =>
                `courses-sidebar-item${isActive || course.id === activeCourseId ? ' courses-sidebar-item-active' : ''}${
                  paidCourseIds.includes(course.id) ? ' courses-sidebar-item-paid' : ''
                }`
              }
            >
              <span className="courses-sidebar-text">
                <span className="courses-sidebar-name">{course.title}</span>
                <span className="courses-sidebar-meta">
                  <StarRating value={course.rating} compact />
                  <span className="courses-sidebar-lessons">{course.lessons} сабак</span>
                </span>
              </span>
              <span className="courses-sidebar-price">{course.price}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const course = courseId ? getCourseById(courseId) : undefined;

  if (!courseId || !course) {
    return <Navigate to="/courses" replace />;
  }

  const paid = isCoursePaid(courseId);
  const learnPath = `/courses/${courseId}/learn`;

  return (
    <section className="courses-page">
      <div className="wrap courses-page-inner">
        <div className="courses-page-head">
          <p className="courses-page-label">Муалим академиясы</p>
          <h1 className="courses-page-title">Акылуу курстар</h1>
          <p className="courses-page-subtitle">
            Курстан тандаңыз, төлөңүз — андан кийин видеолор сайттан көрүлөт.
          </p>
        </div>

        <div className="courses-page-grid">
          <div className="courses-payment-panel ui-card">
            <div className="courses-payment-panel-body">
              <p className="courses-payment-panel-label">Тандалган курс</p>
              <h2 className="courses-payment-course-name">{course.title}</h2>
              <div className="courses-payment-course-meta">
                <StarRating value={course.rating} compact />
                <span>{course.lessons} видео-сабак</span>
                <span>{course.price}</span>
              </div>

              <div className="courses-detail-preview">
                <img
                  src={youtubeThumbnail(course.intro.videoId)}
                  alt=""
                  className="courses-detail-preview-img"
                />
                <div className="courses-detail-preview-overlay">
                  <Play className="h-6 w-6" fill="currentColor" aria-hidden />
                </div>
              </div>

              <p className="courses-payment-course-desc">
                {paid
                  ? 'Курс активдештирилген. Сабактарга өтүп, видеолорду сайттан көрүңүз.'
                  : 'Төлөгөндөн кийин видеолор сайттан ачылат. Ар бир сабактан кийин тест бар.'}
              </p>

              <div className="courses-payment-divider" />

              {paid ? (
                <div className="courses-detail-paid-actions">
                  <Link to={learnPath} className="btn-primary courses-payment-btn w-full">
                    Видеого өтүү
                  </Link>
                </div>
              ) : (
                <CoursePaymentBlock
                  courseId={courseId}
                  courseTitle={course.title}
                  coursePrice={course.price}
                  lessonCount={course.lessons}
                  learnPath={learnPath}
                  navigateOnPaid
                />
              )}
            </div>
          </div>

          <CoursesSidebar activeCourseId={courseId} />
        </div>

        <Link to="/" className="courses-page-back">
          <ArrowLeft className="h-4 w-4" />
          Башкы бетке кайтуу
        </Link>
      </div>
    </section>
  );
}

export function CoursesIndexPage() {
  const first = PAID_COURSES[0];
  if (!first) {
    return (
      <section className="courses-page">
        <div className="wrap courses-page-inner">
          <p className="courses-page-subtitle">Курстар азырынча жок.</p>
        </div>
      </section>
    );
  }
  return <Navigate to={`/courses/${first.id}`} replace />;
}
