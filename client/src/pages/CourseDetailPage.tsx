import { useEffect, useMemo, useState } from 'react';
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
import { getLessonsByCourse, type LessonDto } from '../lib/lesson-api';
import { youtubeThumbnail, youtubeWatchUrl } from '../lib/youtube';
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

function CoursesCatalogTabs({ active }: { active: 'free' | 'paid' }) {
  return (
    <nav className="courses-catalog-tabs" aria-label="Курстар түрү">
      <Link
        to="/courses/free"
        className={`courses-catalog-tab${active === 'free' ? ' courses-catalog-tab-active' : ''}`}
      >
        Бекер сабактар
      </Link>
      <Link
        to="/courses"
        className={`courses-catalog-tab${active === 'paid' ? ' courses-catalog-tab-active' : ''}`}
      >
        Акылуу курстар
      </Link>
    </nav>
  );
}

function CatalogCourseCard({ course, free = false }: { course: CourseSummary; free?: boolean }) {
  const thumbId = course.introVideoId ?? (free ? 'ZkpJ1ezB2TI' : 'mtKKIbWbRWc');
  const blurb = course.shortDescription ?? course.description;

  return (
    <Link to={`/courses/${course.id}`} className="course-catalog-card no-underline">
      <div className="course-catalog-card-media">
        <img src={youtubeThumbnail(thumbId)} alt={course.title} className="course-catalog-card-img" />
        <div className="course-catalog-card-play">
          <div className="play-circle-white">
            <Play className="h-5 w-5 text-navy ml-0.5" fill="currentColor" />
          </div>
        </div>
        <span className={free ? 'video-free-badge' : 'video-paid-badge'}>
          {free ? 'Бекер' : course.priceLabel}
        </span>
        {course.introDurationSeconds ? (
          <span className="course-catalog-card-duration">
            {formatCourseDuration(course.introDurationSeconds)}
          </span>
        ) : null}
      </div>
      <div className="course-catalog-card-body">
        <h3 className="course-catalog-card-title">{course.title}</h3>
        {blurb ? <p className="course-catalog-card-desc">{blurb}</p> : null}
        <div className="course-catalog-card-footer">
          <StarRating compact />
          <span className="course-catalog-card-lessons">{course.lessonCount} сабак</span>
        </div>
        {!free ? <p className="course-catalog-card-price">{course.priceLabel}</p> : null}
      </div>
    </Link>
  );
}

function FreeLessonsSidebar({
  lessons,
  activeLessonId,
  onSelect,
}: {
  lessons: LessonDto[];
  activeLessonId: string;
  onSelect: (lessonId: string) => void;
}) {
  return (
    <aside className="courses-sidebar ui-card">
      <h2 className="courses-sidebar-title">
        <BookOpen className="h-5 w-5" aria-hidden />
        Бардык сабактар ({lessons.length})
      </h2>
      <ul className="courses-sidebar-list free-lessons-sidebar-list">
        {lessons.map((lesson) => {
          const active = lesson.id === activeLessonId;
          return (
            <li key={lesson.id}>
              <button
                type="button"
                className={`courses-sidebar-item free-lesson-sidebar-item courses-sidebar-item-free${
                  active ? ' courses-sidebar-item-active' : ''
                }`}
                onClick={() => onSelect(lesson.id)}
              >
                <span className="free-lesson-sidebar-thumb">
                  <img src={youtubeThumbnail(lesson.youtubeVideoId)} alt="" />
                  <span className="free-lesson-sidebar-play">
                    <Play className="h-3 w-3" fill="currentColor" aria-hidden />
                  </span>
                </span>
                <span className="courses-sidebar-text">
                  <span className="courses-sidebar-name">{lesson.title}</span>
                  <span className="courses-sidebar-lessons">
                    {formatCourseDuration(lesson.durationSeconds)}
                  </span>
                </span>
                <span className="courses-sidebar-price">Бекер</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
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
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => fetchCourseByRef(courseId!),
    enabled: Boolean(courseId),
  });

  const free = course ? isFreeCourse(course) : false;

  const { data: courseLessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['course-lessons', courseId],
    queryFn: () => getLessonsByCourse(courseId!),
    enabled: Boolean(courseId && course && free),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const publishedLessons = useMemo(
    () =>
      (courseLessons ?? [])
        .filter((lesson) => lesson.isPublished)
        .sort((a, b) => a.lessonOrder - b.lessonOrder),
    [courseLessons],
  );

  useEffect(() => {
    if (!publishedLessons.length) {
      setActiveLessonId(null);
      return;
    }
    setActiveLessonId((prev) => {
      if (prev && publishedLessons.some((lesson) => lesson.id === prev)) return prev;
      return publishedLessons[0].id;
    });
  }, [publishedLessons]);

  const { data: paidCoursesData } = useQuery({
    queryKey: ['courses', 'paid'],
    queryFn: () => import('../lib/course-api').then((m) => m.fetchCourses({ type: 'paid', limit: 100 })),
    enabled: Boolean(course && !free),
  });

  const { data: freeCoursesData } = useQuery({
    queryKey: ['courses', 'free'],
    queryFn: () => import('../lib/course-api').then((m) => m.fetchCourses({ type: 'free', limit: 100 })),
    enabled: Boolean(course && !free),
  });

  const sidebarCourses = [
    ...(freeCoursesData?.items ?? []),
    ...(paidCoursesData?.items ?? []),
  ];

  useEffect(() => {
    if (courseId) setPaid(isCoursePaid(courseId));
  }, [courseId]);

  if (isLoading || (free && lessonsLoading)) {
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

  const freeCourse = isFreeCourse(course);
  const coursesListPath = freeCourse ? '/courses/free' : '/courses';
  const learnPath = `/courses/${courseId}/learn`;
  const activeLesson =
    publishedLessons.find((lesson) => lesson.id === activeLessonId) ?? publishedLessons[0];
  const previewVideoId =
    activeLesson?.youtubeVideoId ?? course.introVideoId ?? 'dQw4w9WgXcQ';
  const previewDuration = activeLesson?.durationSeconds ?? course.introDurationSeconds;

  return (
    <section className="courses-page">
      <div className="wrap courses-page-inner">
        <div className="courses-page-head">
          <p className="courses-page-label">Муалим академиясы</p>
          <h1 className="courses-page-title">{freeCourse ? 'Бекер сабактар' : 'Акылуу курстар'}</h1>
          <p className="courses-page-subtitle">
            {freeCourse
              ? 'YouTube видеолорду көрүңүз — төлөм талап кылынбайт.'
              : 'Курстан тандаңыз, төлөңүз — андан кийин видеолор сайттан көрүлөт.'}
          </p>
        </div>

        <div className="courses-page-grid">
          <div className="courses-payment-panel ui-card">
            <div className="courses-payment-panel-body">
              <p className="courses-payment-panel-label">
                {freeCourse ? 'Тандалган сабак' : 'Тандалган курс'}
              </p>
              <h2 className="courses-payment-course-name">
                {freeCourse && activeLesson ? activeLesson.title : course.title}
              </h2>
              <div className="courses-payment-course-meta">
                <StarRating compact />
                {freeCourse && activeLesson ? (
                  <>
                    <span>
                      {activeLesson.lessonOrder} / {publishedLessons.length} сабак
                    </span>
                    <span>Бекер</span>
                  </>
                ) : (
                  <>
                    <span>{course.lessonCount} видео-сабак</span>
                    <span>{course.priceLabel}</span>
                  </>
                )}
              </div>

              <div className="courses-detail-preview">
                <img src={youtubeThumbnail(previewVideoId)} alt="" className="courses-detail-preview-img" />
                <div className="courses-detail-preview-overlay">
                  <Play className="h-6 w-6" fill="currentColor" aria-hidden />
                </div>
              </div>

              <p className="courses-payment-course-desc">
                {freeCourse && activeLesson?.description
                  ? activeLesson.description
                  : course.description}
              </p>
              {previewDuration ? (
                <p className="courses-payment-hint">
                  Узактыгы: {formatCourseDuration(previewDuration)}
                </p>
              ) : null}

              <div className="courses-payment-divider" />

              {freeCourse ? (
                publishedLessons.length > 0 && activeLesson ? (
                  <div className="courses-detail-paid-actions">
                    <a
                      href={youtubeWatchUrl(activeLesson.youtubeVideoId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary courses-payment-btn w-full"
                    >
                      YouTube'да көрүү
                    </a>
                  </div>
                ) : (
                  <p className="courses-payment-hint">Жарыяланган сабактар азырынча жок.</p>
                )
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

          {freeCourse ? (
            publishedLessons.length > 0 && activeLesson ? (
              <FreeLessonsSidebar
                lessons={publishedLessons}
                activeLessonId={activeLesson.id}
                onSelect={setActiveLessonId}
              />
            ) : (
              <aside className="courses-sidebar ui-card">
                <h2 className="courses-sidebar-title">Бардык сабактар (0)</h2>
                <p className="courses-page-subtitle m-0 px-1">Сабактар азырынча жок.</p>
              </aside>
            )
          ) : (
            <CoursesSidebar activeCourseId={courseId} courses={sidebarCourses} />
          )}
        </div>

        <Link to={coursesListPath} className="courses-page-back">
          <ArrowLeft className="h-4 w-4" />
          {freeCourse ? 'Бардык бекер сабактарга' : 'Бардык курстарга'} кайтуу
        </Link>
      </div>
    </section>
  );
}

export function FreeCoursesPage() {
  const { data: freeCourses, isLoading } = useQuery({
    queryKey: ['courses', 'free'],
    queryFn: () => import('../lib/course-api').then((m) => m.fetchCourses({ type: 'free', limit: 100 })),
  });

  if (isLoading) {
    return (
      <section className="courses-catalog-page">
        <div className="wrap courses-catalog-loading">
          <p className="courses-page-subtitle">Жүктөлүүдө...</p>
        </div>
      </section>
    );
  }

  const items = freeCourses?.items ?? [];

  return (
    <section className="courses-catalog-page">
      <div className="courses-catalog-hero">
        <div className="wrap courses-catalog-hero-inner">
          <p className="courses-catalog-hero-label">Муалим академиясы</p>
          <h1 className="courses-catalog-hero-title">Бекер сабактар</h1>
          <p className="courses-catalog-hero-text">
            YouTube видеолорду көрүңүз — төлөм талап кылынбайт.
          </p>
          <CoursesCatalogTabs active="free" />
        </div>
      </div>

      <div className="wrap courses-catalog-body">
        {items.length > 0 ? (
          <>
            <p className="courses-catalog-count">{items.length} сабак табылды</p>
            <div className="courses-catalog-grid">
              {items.map((course) => (
                <CatalogCourseCard key={course.id} course={course} free />
              ))}
            </div>
          </>
        ) : (
          <div className="courses-catalog-empty ui-card">
            <p className="courses-catalog-empty-title">Бекер сабактар азырынча жок</p>
            <p className="courses-catalog-empty-text">Жакында жаңы видеолор кошулат.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function CoursesIndexPage() {
  const { data: paidCourses, isLoading } = useQuery({
    queryKey: ['courses', 'paid'],
    queryFn: () => import('../lib/course-api').then((m) => m.fetchCourses({ type: 'paid', limit: 100 })),
  });

  if (isLoading) {
    return (
      <section className="courses-catalog-page">
        <div className="wrap courses-catalog-loading">
          <p className="courses-page-subtitle">Жүктөлүүдө...</p>
        </div>
      </section>
    );
  }

  const items = paidCourses?.items ?? [];

  return (
    <section className="courses-catalog-page">
      <div className="courses-catalog-hero">
        <div className="wrap courses-catalog-hero-inner">
          <p className="courses-catalog-hero-label">Муалим академиясы</p>
          <h1 className="courses-catalog-hero-title">Акылуу курстар</h1>
          <p className="courses-catalog-hero-text">
            Курстан тандаңыз, төлөңүз — андан кийин видеолор сайттан көрүлөт.
          </p>
          <CoursesCatalogTabs active="paid" />
        </div>
      </div>

      <div className="wrap courses-catalog-body">
        {items.length > 0 ? (
          <>
            <p className="courses-catalog-count">{items.length} курс табылды</p>
            <div className="courses-catalog-grid">
              {items.map((course) => (
                <CatalogCourseCard key={course.id} course={course} />
              ))}
            </div>
          </>
        ) : (
          <div className="courses-catalog-empty ui-card">
            <p className="courses-catalog-empty-title">Акылуу курстар азырынча жок</p>
            <p className="courses-catalog-empty-text">
              Бекер сабактарды{' '}
              <Link to="/courses/free" className="courses-catalog-empty-link">
                бул жерден
              </Link>{' '}
              көрүңүз.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

