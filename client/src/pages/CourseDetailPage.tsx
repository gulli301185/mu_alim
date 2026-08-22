import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, GraduationCap, Lock, Play, Star, Youtube } from 'lucide-react';
import {
  fetchCourseByRef,
  fetchFreeLessons,
  formatCourseDuration,
  isFreeCourse,
  type CourseSummary,
  type FreeLessonItem,
} from '../lib/course-api';
import { isCoursePaid } from '../lib/courseAccess';
import { getLessonsByCourse, type LessonDto } from '../lib/lesson-api';
import { youtubeThumbnail } from '../lib/youtube';
import { SITE } from '../data/landing';
import { CourseReviewsSection } from '../components/CourseReviews';
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

function PaidLessonsSidebar({
  lessons,
  activeLessonId,
  unlocked,
  onSelect,
}: {
  lessons: LessonDto[];
  activeLessonId: string;
  unlocked: boolean;
  onSelect: (lessonId: string) => void;
}) {
  return (
    <aside className="courses-sidebar ui-card">
      <h2 className="courses-sidebar-title">
        <BookOpen className="h-5 w-5" aria-hidden />
        Сабактар ({lessons.length})
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
                }${!unlocked ? ' courses-sidebar-item-locked' : ''}`}
                onClick={() => onSelect(lesson.id)}
              >
                <span className="free-lesson-sidebar-thumb">
                  <img src={youtubeThumbnail(lesson.youtubeVideoId)} alt="" />
                  <span className="free-lesson-sidebar-play">
                    {unlocked ? (
                      <Play className="h-3 w-3" fill="currentColor" aria-hidden />
                    ) : (
                      <Lock className="h-3 w-3" aria-hidden />
                    )}
                  </span>
                </span>
                <span className="courses-sidebar-text">
                  <span className="courses-sidebar-name">{lesson.title}</span>
                  <span className="courses-sidebar-lessons">
                    {formatCourseDuration(lesson.durationSeconds)}
                  </span>
                </span>
                <span className="courses-sidebar-price">{unlocked ? 'Ачылды' : 'Кулуп'}</span>
              </button>
            </li>
          );
        })}
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

  const { data: courseLessons } = useQuery({
    queryKey: ['course-lessons', courseId],
    queryFn: () => getLessonsByCourse(courseId!),
    enabled: Boolean(courseId && course),
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
    if (courseId) setPaid(isCoursePaid(courseId));
  }, [courseId]);

  useEffect(() => {
    if (!publishedLessons.length) {
      setActiveLessonId(null);
      return;
    }
    setActiveLessonId((prev) => {
      if (prev && publishedLessons.some((lesson) => lesson.id === prev)) {
        return prev;
      }
      return publishedLessons[0].id;
    });
  }, [publishedLessons]);

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

  if (isFreeCourse(course)) {
    return <Navigate to={`/courses/${course.slug}/learn`} replace />;
  }

  const coursesListPath = '/courses';
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
          <h1 className="courses-page-title">{course.title}</h1>
          <p className="courses-page-subtitle">
            Курстун сабактарын караңыз. Төлөгөндөн кийин видеолор ачылат.
          </p>
        </div>

        <div className="courses-page-grid">
          <div className="courses-payment-panel ui-card">
            <div className="courses-payment-panel-body">
              <p className="courses-payment-panel-label">
                {activeLesson ? 'Тандалган сабак' : 'Тандалган курс'}
              </p>
              <h2 className="courses-payment-course-name">
                {activeLesson ? activeLesson.title : course.title}
              </h2>
              <div className="courses-payment-course-meta">
                <StarRating compact />
                {activeLesson ? (
                  <>
                    <span>
                      {activeLesson.lessonOrder} / {publishedLessons.length} сабак
                    </span>
                    <span>{course.priceLabel}</span>
                  </>
                ) : (
                  <>
                    <span>{publishedLessons.length || course.lessonCount} видео-сабак</span>
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

              <div className="courses-payment-divider" />

              {paid ? (
                <div className="courses-detail-paid-actions">
                  <p className="courses-payment-hint">
                    Төлөм ырасталды. Сабактар Telegram группасында.
                  </p>
                  <a
                    href={SITE.paidTelegramInvite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary courses-payment-btn w-full"
                  >
                    Telegramга өтүү
                  </a>
                </div>
              ) : (
                <CoursePaymentBlock
                  courseId={courseId}
                  courseTitle={course.title}
                  coursePrice={course.priceLabel}
                  lessonCount={publishedLessons.length || course.lessonCount}
                  telegramUrl={SITE.paidTelegramInvite}
                  onPaid={() => setPaid(true)}
                />
              )}

              <p className="courses-payment-course-desc">
                {activeLesson?.description || course.description}
              </p>
              {previewDuration ? (
                <p className="courses-payment-hint">
                  Узактыгы: {formatCourseDuration(previewDuration)}
                </p>
              ) : null}
            </div>
          </div>

          {publishedLessons.length > 0 && activeLesson ? (
            <PaidLessonsSidebar
              lessons={publishedLessons}
              activeLessonId={activeLesson.id}
              unlocked={paid}
              onSelect={setActiveLessonId}
            />
          ) : (
            <aside className="courses-sidebar ui-card">
              <h2 className="courses-sidebar-title">Сабактар (0)</h2>
              <p className="courses-page-subtitle m-0 px-1">Сабактар азырынча жок.</p>
            </aside>
          )}
        </div>

        <CourseReviewsSection
          courseRef={courseId}
          courseTitle={course.title}
          courseSlug={course.slug}
          hideCards
        />

        <Link to={coursesListPath} className="courses-page-back">
          <ArrowLeft className="h-4 w-4" />
          Бардык курстарга кайтуу
        </Link>
      </div>
    </section>
  );
}

function CoursesHubSwitch({ active }: { active: 'free' | 'paid' }) {
  return (
    <div className="courses-hub-switch" role="tablist" aria-label="Курс түрлөрү">
      {active === 'free' ? (
        <span className="courses-hub-switch-card courses-hub-switch-card-active" role="tab" aria-current="page">
          <span className="courses-hub-switch-icon courses-hub-switch-icon-free">
            <Youtube className="h-5 w-5" aria-hidden />
          </span>
          <span className="courses-hub-switch-text">
            <strong>Бекер сабактар</strong>
            <span>YouTube видеолор сайтта</span>
          </span>
        </span>
      ) : (
        <Link to="/courses/free" className="courses-hub-switch-card" role="tab">
          <span className="courses-hub-switch-icon courses-hub-switch-icon-free">
            <Youtube className="h-5 w-5" aria-hidden />
          </span>
          <span className="courses-hub-switch-text">
            <strong>Бекер сабактар</strong>
            <span>YouTube видеолор сайтта</span>
          </span>
        </Link>
      )}
      {active === 'paid' ? (
        <span className="courses-hub-switch-card courses-hub-switch-card-active" role="tab" aria-current="page">
          <span className="courses-hub-switch-icon courses-hub-switch-icon-paid">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <span className="courses-hub-switch-text">
            <strong>Акылуу курстар</strong>
            <span>Толук программа жана Telegram</span>
          </span>
        </span>
      ) : (
        <Link to="/courses" className="courses-hub-switch-card" role="tab">
          <span className="courses-hub-switch-icon courses-hub-switch-icon-paid">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <span className="courses-hub-switch-text">
            <strong>Акылуу курстар</strong>
            <span>Толук программа жана Telegram</span>
          </span>
        </Link>
      )}
    </div>
  );
}

function CourseHubCard({ course, free = false }: { course: CourseSummary; free?: boolean }) {
  return (
    <Link
      to={free ? `/courses/${course.slug}/learn` : `/courses/${course.slug}`}
      className="courses-hub-card no-underline"
    >
      <div className="courses-hub-card-media">
        <img
          src={youtubeThumbnail(course.introVideoId ?? (free ? 'ZkpJ1ezB2TI' : 'mtKKIbWbRWc'))}
          alt=""
          className="courses-hub-card-img"
        />
        <span className="courses-hub-card-play" aria-hidden>
          <Play className="h-5 w-5" fill="currentColor" />
        </span>
        <span className={free ? 'video-free-badge' : 'video-paid-badge'}>
          {free ? 'Бекер' : course.priceLabel}
        </span>
        {course.introDurationSeconds ? (
          <span className="courses-hub-card-time">{formatCourseDuration(course.introDurationSeconds)}</span>
        ) : null}
      </div>
      <div className="courses-hub-card-body">
        <h2 className="courses-hub-card-title">{course.title}</h2>
        <p className="courses-hub-card-desc">{course.shortDescription || course.description}</p>
        <div className="courses-hub-card-meta">
          <StarRating compact />
          <span>{course.lessonCount} сабак</span>
        </div>
        <span className="courses-hub-card-cta">{free ? 'Сабактарды көрүү' : 'Курска кирүү'}</span>
      </div>
    </Link>
  );
}

function FreeLessonHubCard({ lesson }: { lesson: FreeLessonItem }) {
  return (
    <Link
      to={`/courses/${lesson.courseSlug}/learn?lesson=${lesson.id}`}
      className="courses-hub-card no-underline"
    >
      <div className="courses-hub-card-media">
        <img
          src={youtubeThumbnail(lesson.youtubeVideoId)}
          alt=""
          className="courses-hub-card-img"
        />
        <span className="courses-hub-card-play" aria-hidden>
          <Play className="h-5 w-5" fill="currentColor" />
        </span>
        <span className="video-free-badge">Бекер</span>
        {lesson.durationSeconds ? (
          <span className="courses-hub-card-time">{formatCourseDuration(lesson.durationSeconds)}</span>
        ) : null}
      </div>
      <div className="courses-hub-card-body">
        <h2 className="courses-hub-card-title">{lesson.title}</h2>
        {lesson.description ? (
          <p className="courses-hub-card-desc">{lesson.description}</p>
        ) : (
          <p className="courses-hub-card-desc">{lesson.courseTitle}</p>
        )}
        <div className="courses-hub-card-meta">
          <span>{lesson.lessonOrder}-сабак</span>
        </div>
        <span className="courses-hub-card-cta">Сабакты көрүү</span>
      </div>
    </Link>
  );
}

export function FreeCoursesPage() {
  const { data: freeLessons, isLoading } = useQuery({
    queryKey: ['free-lessons'],
    queryFn: fetchFreeLessons,
  });

  if (isLoading) {
    return (
      <section className="courses-hub">
        <div className="wrap courses-hub-inner">
          <p className="courses-hub-muted">Жүктөлүүдө...</p>
        </div>
      </section>
    );
  }

  const items = freeLessons?.items ?? [];

  return (
    <section className="courses-hub">
      <div className="wrap courses-hub-inner">
        <div className="courses-hub-head">
          <h1 className="courses-hub-title">Курстар</h1>
          <p className="courses-hub-lead">
            Бекер сабактарды сайттан көрүңүз же акылуу программаны тандаңыз
          </p>
        </div>

        <CoursesHubSwitch active="free" />

        {items.length > 0 ? (
          <div className="courses-hub-grid">
            {items.map((lesson) => (
              <FreeLessonHubCard key={lesson.id} lesson={lesson} />
            ))}
          </div>
        ) : (
          <div className="courses-hub-empty ui-card">
            <p className="courses-hub-empty-title">Бекер сабактар азырынча жок</p>
            <p className="courses-hub-muted">Акылуу курстарды карап көрүңүз.</p>
            <Link to="/courses" className="btn-gold courses-hub-empty-btn">
              Акылуу курстарга өтүү
            </Link>
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
      <section className="courses-hub">
        <div className="wrap courses-hub-inner">
          <p className="courses-hub-muted">Жүктөлүүдө...</p>
        </div>
      </section>
    );
  }

  const items = paidCourses?.items ?? [];

  return (
    <section className="courses-hub">
      <div className="wrap courses-hub-inner">
        <div className="courses-hub-head">
          <h1 className="courses-hub-title">Курстар</h1>
          <p className="courses-hub-lead">
            Бекер сабактарды сайттан көрүңүз же акылуу программаны тандаңыз
          </p>
        </div>

        <CoursesHubSwitch active="paid" />

        {items.length > 0 ? (
          <div className="courses-hub-grid">
            {items.map((course) => (
              <CourseHubCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <div className="courses-hub-empty ui-card">
            <p className="courses-hub-empty-title">Акылуу курстар азырынча жок</p>
            <p className="courses-hub-muted">Бекер сабактарды көрүп баштасаңыз болот.</p>
            <Link to="/courses/free" className="btn-gold courses-hub-empty-btn">
              Бекер сабактарга өтүү
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
