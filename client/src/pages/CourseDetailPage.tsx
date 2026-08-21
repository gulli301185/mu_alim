import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, CheckCircle2, GraduationCap, Lock, Play, Star, Youtube } from 'lucide-react';
import {
  fetchCourseByRef,
  fetchFreeLessons,
  formatCourseDuration,
  isFreeCourse,
  type CourseSummary,
  type FreeLessonItem,
} from '../lib/course-api';
import {
  isCoursePaid,
  loadCourseProgress,
  markLessonComplete,
} from '../lib/courseAccess';
import { CourseYoutubePlayer } from '../components/CourseYoutubeLink';
import { getLessonsByCourse, type LessonDto } from '../lib/lesson-api';
import { youtubeThumbnail } from '../lib/youtube';
import { SITE } from '../data/landing';
import { CoursePaymentBlock } from './CoursesPage';

function isFreeLessonUnlocked(
  lessons: LessonDto[],
  lessonId: string,
  completedLessonIds: string[],
) {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index <= 0) return true;
  return completedLessonIds.includes(lessons[index - 1].id);
}

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

function FreeLessonsSidebar({
  lessons,
  activeLessonId,
  completedLessonIds,
  onSelect,
}: {
  lessons: LessonDto[];
  activeLessonId: string;
  completedLessonIds: string[];
  onSelect: (lessonId: string) => void;
}) {
  const watchingIncomplete = !completedLessonIds.includes(activeLessonId);

  return (
    <aside className="courses-sidebar ui-card">
      <h2 className="courses-sidebar-title">
        <BookOpen className="h-5 w-5" aria-hidden />
        Бардык сабактар ({lessons.length})
      </h2>
      <ul className="courses-sidebar-list free-lessons-sidebar-list">
        {lessons.map((lesson) => {
          const active = lesson.id === activeLessonId;
          const completed = completedLessonIds.includes(lesson.id);
          const unlocked = isFreeLessonUnlocked(lessons, lesson.id, completedLessonIds);
          return (
            <li key={lesson.id}>
              <button
                type="button"
                className={`courses-sidebar-item free-lesson-sidebar-item courses-sidebar-item-free${
                  active ? ' courses-sidebar-item-active' : ''
                }${completed ? ' courses-sidebar-item-done' : ''}${
                  !unlocked ? ' courses-sidebar-item-locked' : ''
                }`}
                disabled={!unlocked || (watchingIncomplete && !active)}
                onClick={() => {
                  if (!unlocked) return;
                  if (watchingIncomplete && lesson.id !== activeLessonId) return;
                  onSelect(lesson.id);
                }}
              >
                <span className="free-lesson-sidebar-thumb">
                  <img src={youtubeThumbnail(lesson.youtubeVideoId)} alt="" />
                  <span className="free-lesson-sidebar-play">
                    {completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    ) : unlocked ? (
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
                <span className="courses-sidebar-price">
                  {completed ? 'Көрүлдү' : unlocked ? 'Бекер' : 'Кулуп'}
                </span>
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
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>(() =>
    courseId ? loadCourseProgress(courseId).completedLessonIds : [],
  );
  const [openedCompleted, setOpenedCompleted] = useState(false);

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
    if (courseId) {
      setPaid(isCoursePaid(courseId));
      setCompletedLessonIds(loadCourseProgress(courseId).completedLessonIds);
    }
  }, [courseId]);

  useEffect(() => {
    if (!publishedLessons.length) {
      setActiveLessonId(null);
      return;
    }
    setActiveLessonId((prev) => {
      if (
        prev &&
        publishedLessons.some((lesson) => lesson.id === prev) &&
        isFreeLessonUnlocked(publishedLessons, prev, completedLessonIds)
      ) {
        return prev;
      }
      const firstOpen =
        publishedLessons.find((lesson) =>
          isFreeLessonUnlocked(publishedLessons, lesson.id, completedLessonIds),
        ) ?? publishedLessons[0];
      return firstOpen.id;
    });
  }, [publishedLessons, completedLessonIds]);

  useEffect(() => {
    if (!activeLessonId || !courseId) return;
    setOpenedCompleted(loadCourseProgress(courseId).completedLessonIds.includes(activeLessonId));
  }, [activeLessonId, courseId]);

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

  const handleFreeWatchComplete = useCallback(() => {
    if (!courseId || !activeLessonId) return;
    if (completedLessonIds.includes(activeLessonId)) return;
    const next = markLessonComplete(courseId, activeLessonId);
    setCompletedLessonIds(next.completedLessonIds);
  }, [activeLessonId, completedLessonIds, courseId]);

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

  const freeCourse = false;
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
          <h1 className="courses-page-title">{freeCourse ? 'Бекер сабактар' : 'Акылуу курстар'}</h1>
          <p className="courses-page-subtitle">
            {freeCourse
              ? 'Видеону сайттан көрүңүз. Биринчи сабак бүткөнчө кийинкиге өтүүгө болбойт.'
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

              {freeCourse && activeLesson ? (
                <div className="courses-free-watch">
                  <CourseYoutubePlayer
                    key={activeLesson.id}
                    videoId={activeLesson.youtubeVideoId}
                    title={activeLesson.title}
                    onWatchComplete={handleFreeWatchComplete}
                    requireFullWatch={!openedCompleted}
                  />
                </div>
              ) : (
                <div className="courses-detail-preview">
                  <img src={youtubeThumbnail(previewVideoId)} alt="" className="courses-detail-preview-img" />
                  <div className="courses-detail-preview-overlay">
                    <Play className="h-6 w-6" fill="currentColor" aria-hidden />
                  </div>
                </div>
              )}

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
                  completedLessonIds.includes(activeLesson.id) ? (
                    <div className="courses-detail-paid-actions">
                      <p className="courses-payment-hint">Сабак аякталды. Кийинки сабакка өтсөңүз болот.</p>
                      {(() => {
                        const nextLesson = publishedLessons.find(
                          (lesson) =>
                            isFreeLessonUnlocked(publishedLessons, lesson.id, completedLessonIds) &&
                            !completedLessonIds.includes(lesson.id),
                        );
                        return nextLesson ? (
                          <button
                            type="button"
                            className="btn-primary courses-payment-btn w-full"
                            onClick={() => setActiveLessonId(nextLesson.id)}
                          >
                            Кийинки сабак
                          </button>
                        ) : (
                          <p className="courses-payment-hint">Бардык сабактар аякталды.</p>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="courses-payment-hint">
                      Видеону аягына чейин көрүңүз — андан кийин кийинки сабак ачылат.
                    </p>
                  )
                ) : (
                  <p className="courses-payment-hint">Жарыяланган сабактар азырынча жок.</p>
                )
              ) : paid ? (
                <div className="courses-detail-paid-actions">
                  <p className="courses-payment-hint">Сабактар Telegram группасында.</p>
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
                  lessonCount={course.lessonCount}
                  telegramUrl={SITE.paidTelegramInvite}
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
                completedLessonIds={completedLessonIds}
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
      to={free ? `/courses/${course.slug}/learn` : `/courses/${course.id}`}
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
