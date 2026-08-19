import { useEffect, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Play, Star } from 'lucide-react';
import {
  fetchCourseByRef,
  formatCourseDuration,
  isFreeCourse,
  type CourseSummary,
} from '../lib/course-api';
import { isCoursePaid } from '../lib/courseAccess';
import { youtubeThumbnail } from '../lib/youtube';
import { CoursePaymentBlock } from './CoursesPage';

function StarRating({ compact = false }: { compact?: boolean }) {
  const value = 4.9;
  return (
    <span className={`course-stars${compact ? ' course-stars-compact' : ''}`} aria-label={`${value} из 5`}>
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

function CoursesSidebar({
  activeCourseId,
  courses,
}: {
  activeCourseId: string;
  courses: CourseSummary[];
}) {
  const paidCourseIds = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('mualim-paid-courses') ?? '[]') as string[] : [];

  return (
    <aside className="courses-sidebar ui-card">
      <h2 className="courses-sidebar-title">
        <BookOpen className="h-5 w-5" aria-hidden />
        Бардык курстар
      </h2>
      <ul className="courses-sidebar-list">
        {courses.map((course) => (
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
                  <StarRating compact />
                  <span className="courses-sidebar-lessons">{course.lessonCount} сабак</span>
                </span>
              </span>
              <span className="courses-sidebar-price">{course.priceLabel}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [paid, setPaid] = useState(false);

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => fetchCourseByRef(courseId!),
    enabled: Boolean(courseId),
  });

  const { data: paidCoursesData } = useQuery({
    queryKey: ['courses', 'paid'],
    queryFn: () => import('../lib/course-api').then((m) => m.fetchCourses({ type: 'paid', limit: 100 })),
  });

  const { data: freeCoursesData } = useQuery({
    queryKey: ['courses', 'free'],
    queryFn: () => import('../lib/course-api').then((m) => m.fetchCourses({ type: 'free', limit: 100 })),
  });

  const sidebarCourses = [
    ...(freeCoursesData?.items ?? []),
    ...(paidCoursesData?.items ?? []),
  ];

  useEffect(() => {
    if (courseId) setPaid(isCoursePaid(courseId));
  }, [courseId]);

  if (isLoading) {
    return (
      <section className="courses-page">
        <div className="wrap courses-page-inner">
          <p className="courses-page-subtitle">Жүктөлүүдө...</p>
        </div>
      </section>
    );
  }

  if (isError || !course || !courseId) {
    return (
      <section className="courses-page">
        <div className="wrap courses-page-inner">
          <p className="courses-page-subtitle">Курс табылган жок.</p>
          <Link to="/courses" className="courses-page-back">
            <ArrowLeft className="h-4 w-4" />
            Курстарга кайтуу
          </Link>
        </div>
      </section>
    );
  }

  const free = isFreeCourse(course);
  const learnPath = `/courses/${courseId}/learn`;
  const introVideoId = course.introVideoId ?? 'dQw4w9WgXcQ';

  return (
    <section className="courses-page">
      <div className="wrap courses-page-inner">
        <div className="courses-page-head">
          <p className="courses-page-label">Муалим академиясы</p>
          <h1 className="courses-page-title">{free ? 'Бекер курстар' : 'Акылуу курстар'}</h1>
          <p className="courses-page-subtitle">
            {free
              ? 'YouTube видеолорду сайттан көрүңүз — төлөм талап кылынбайт.'
              : 'Курстан тандаңыз, төлөңүз — андан кийин видеолор сайттан көрүлөт.'}
          </p>
        </div>

        <div className="courses-page-grid">
          <div className="courses-payment-panel ui-card">
            <div className="courses-payment-panel-body">
              <p className="courses-payment-panel-label">Тандалган курс</p>
              <h2 className="courses-payment-course-name">{course.title}</h2>
              <div className="courses-payment-course-meta">
                <StarRating compact />
                <span>{course.lessonCount} видео-сабак</span>
                <span>{course.priceLabel}</span>
              </div>

              <div className="courses-detail-preview">
                <img src={youtubeThumbnail(introVideoId)} alt="" className="courses-detail-preview-img" />
                <div className="courses-detail-preview-overlay">
                  <Play className="h-6 w-6" fill="currentColor" aria-hidden />
                </div>
              </div>

              <p className="courses-payment-course-desc">{course.description}</p>
              {course.introDurationSeconds ? (
                <p className="courses-payment-hint">
                  Киришүү сабак: {formatCourseDuration(course.introDurationSeconds)}
                </p>
              ) : null}

              <div className="courses-payment-divider" />

              {free ? (
                <div className="courses-detail-paid-actions">
                  <Link to={learnPath} className="btn-primary courses-payment-btn w-full">
                    Видеого өтүү
                  </Link>
                </div>
              ) : paid ? (
                <div className="courses-detail-paid-actions">
                  <Link to={learnPath} className="btn-primary courses-payment-btn w-full">
                    Видеого өтүү
                  </Link>
                </div>
              ) : (
                <CoursePaymentBlock
                  courseId={courseId}
                  courseTitle={course.title}
                  coursePrice={course.priceLabel}
                  lessonCount={course.lessonCount}
                  learnPath={learnPath}
                  navigateOnPaid
                  onPaid={() => setPaid(true)}
                />
              )}
            </div>
          </div>

          <CoursesSidebar activeCourseId={courseId} courses={sidebarCourses} />
        </div>

        <Link to="/courses" className="courses-page-back">
          <ArrowLeft className="h-4 w-4" />
          Бардык курстарга кайтуу
        </Link>
      </div>
    </section>
  );
}

export function CoursesIndexPage() {
  const { data: freeCourses, isLoading: freeLoading } = useQuery({
    queryKey: ['courses', 'free'],
    queryFn: () => import('../lib/course-api').then((m) => m.fetchCourses({ type: 'free', limit: 100 })),
  });

  const { data: paidCourses, isLoading: paidLoading } = useQuery({
    queryKey: ['courses', 'paid'],
    queryFn: () => import('../lib/course-api').then((m) => m.fetchCourses({ type: 'paid', limit: 100 })),
  });

  if (freeLoading || paidLoading) {
    return (
      <section className="courses-page">
        <div className="wrap courses-page-inner">
          <p className="courses-page-subtitle">Жүктөлүүдө...</p>
        </div>
      </section>
    );
  }

  const firstFree = freeCourses?.items[0];
  const firstPaid = paidCourses?.items[0];

  return (
    <section className="courses-page">
      <div className="wrap courses-page-inner">
        <div className="courses-page-head">
          <p className="courses-page-label">Муалим академиясы</p>
          <h1 className="courses-page-title">Курстар</h1>
          <p className="courses-page-subtitle">Бекер жана акылуу онлайн курстар</p>
        </div>

        {firstFree ? (
          <div className="courses-index-section">
            <h2 className="courses-index-section-title">Бекер курстар</h2>
            <div className="courses-index-grid">
              {freeCourses?.items.map((course) => (
                <Link key={course.id} to={`/courses/${course.id}`} className="course-card no-underline">
                  <div className="course-card-video">
                    <img
                      src={youtubeThumbnail(course.introVideoId ?? 'ZkpJ1ezB2TI')}
                      alt={course.title}
                      className="course-card-img"
                    />
                    <span className="video-free-badge">Бекер</span>
                  </div>
                  <div className="course-card-body">
                    <p className="course-card-title">{course.title}</p>
                    <p className="course-card-intro">{course.lessonCount} видео-сабак</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {firstPaid ? (
          <div className="courses-index-section">
            <h2 className="courses-index-section-title">Акылуу курстар</h2>
            <div className="courses-index-grid">
              {paidCourses?.items.map((course) => (
                <Link key={course.id} to={`/courses/${course.id}`} className="course-card no-underline">
                  <div className="course-card-video">
                    <img
                      src={youtubeThumbnail(course.introVideoId ?? 'mtKKIbWbRWc')}
                      alt={course.title}
                      className="course-card-img"
                    />
                    <span className="video-paid-badge">{course.priceLabel}</span>
                  </div>
                  <div className="course-card-body">
                    <p className="course-card-title">{course.title}</p>
                    <p className="course-card-intro">{course.lessonCount} видео-сабак</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {!firstFree && !firstPaid ? (
          <p className="courses-page-subtitle">Курстар азырынча жок.</p>
        ) : null}
      </div>
    </section>
  );
}
