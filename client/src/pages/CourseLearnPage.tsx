import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  PlayCircle,
} from 'lucide-react';
import { buildCourseLessons, getCourseById, isLessonUnlocked } from '../data/courseLessons';
import {
  isCoursePaid,
  loadCourseProgress,
  markLessonComplete,
  type CourseProgress,
} from '../lib/courseAccess';
import { CoursePaymentBlock } from './CoursesPage';

type LessonPhase = 'video' | 'test' | 'review';
type ReviewTab = 'video' | 'test';

function canAccessLesson(
  paid: boolean,
  lessons: ReturnType<typeof buildCourseLessons>,
  lessonId: string,
  completedLessonIds: string[],
) {
  if (!paid) return false;
  if (completedLessonIds.includes(lessonId)) return true;
  return isLessonUnlocked(lessons, lessonId, completedLessonIds);
}

export function CourseLearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const course = courseId ? getCourseById(courseId) : undefined;
  const lessons = useMemo(() => (courseId ? buildCourseLessons(courseId) : []), [courseId]);

  const [paid, setPaid] = useState(() => (courseId ? isCoursePaid(courseId) : false));
  const [progress, setProgress] = useState<CourseProgress>(() =>
    courseId ? loadCourseProgress(courseId) : { completedLessonIds: [] },
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [phase, setPhase] = useState<LessonPhase>('video');
  const [videoReady, setVideoReady] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [reviewTab, setReviewTab] = useState<ReviewTab>('video');

  useEffect(() => {
    if (!courseId || !course) {
      navigate('/courses', { replace: true });
      return;
    }
    setPaid(isCoursePaid(courseId));
    setProgress(loadCourseProgress(courseId));
  }, [courseId, course, navigate]);

  useEffect(() => {
    if (!lessons.length) return;

    if (!paid) {
      setActiveLessonId(lessons[0].id);
      return;
    }

    const firstOpen =
      lessons.find((l) => canAccessLesson(paid, lessons, l.id, progress.completedLessonIds)) ??
      lessons[0];

    setActiveLessonId((prev) => {
      if (prev && canAccessLesson(paid, lessons, prev, progress.completedLessonIds)) return prev;
      return firstOpen.id;
    });
  }, [lessons, progress.completedLessonIds, paid]);

  useEffect(() => {
    setAnswers([]);
    setTestSubmitted(false);
    setVideoReady(false);

    if (!activeLessonId || !lessons.length) return;

    const lesson = lessons.find((l) => l.id === activeLessonId);
    if (!lesson) return;

    if (!canAccessLesson(paid, lessons, lesson.id, progress.completedLessonIds)) {
      setPhase('video');
      return;
    }

    if (progress.completedLessonIds.includes(lesson.id)) {
      setPhase('review');
      setReviewTab('video');
      return;
    }

    setPhase('video');
    setReviewTab('video');
  }, [activeLessonId, lessons, progress.completedLessonIds, paid]);

  useEffect(() => {
    if (phase !== 'video' || !activeLessonId || !paid) return;
    setVideoReady(false);
    const timer = window.setTimeout(() => setVideoReady(true), 5000);
    return () => window.clearTimeout(timer);
  }, [activeLessonId, phase, paid]);

  const activeLesson = lessons.find((l) => l.id === activeLessonId);
  const completedCount = progress.completedLessonIds.length;
  const activeAccessible = activeLesson
    ? canAccessLesson(paid, lessons, activeLesson.id, progress.completedLessonIds)
    : false;

  const handleVideoComplete = () => {
    if (!videoReady || !activeAccessible) return;
    setPhase('test');
    setAnswers(activeLesson?.tests.map(() => -1) ?? []);
    setTestSubmitted(false);
  };

  const handleTestSubmit = () => {
    if (!activeLesson || !courseId || !activeAccessible) return;
    if (answers.some((a) => a < 0)) return;

    setTestSubmitted(true);
    const correct = activeLesson.tests.filter((t, i) => answers[i] === t.correctIndex).length;
    const passed = correct / activeLesson.tests.length >= 0.8;

    if (passed) {
      const next = markLessonComplete(courseId, activeLesson.id);
      setProgress(next);
      setPhase('review');
      setReviewTab('video');
    }
  };

  const handlePaid = () => {
    setPaid(true);
    setProgress(loadCourseProgress(courseId!));
  };

  if (!course || !courseId || !activeLesson) {
    return null;
  }

  const testPassed =
    testSubmitted &&
    activeLesson.tests.filter((t, i) => answers[i] === t.correctIndex).length /
      activeLesson.tests.length >=
      0.8;

  return (
    <section className="course-learn-page">
      <div className="wrap course-learn-inner">
        <div className="course-learn-head">
          <Link to="/courses" className="course-learn-back">
            <ArrowLeft className="h-4 w-4" />
            Курстарга кайтуу
          </Link>
          <div>
            <p className="course-learn-label">Менин курсум</p>
            <h1 className="course-learn-title">{course.title}</h1>
            <p className="course-learn-stats">
              {course.lessons} видео-сабак · {completedCount} аякталды ·{' '}
              {course.lessons - completedCount} калды
            </p>
          </div>
        </div>

        <div className="course-learn-grid">
          <aside className="course-learn-sidebar ui-card">
            <h2 className="course-learn-sidebar-title">
              Видеолор ({course.lessons})
            </h2>
            <ul className="course-learn-lessons">
              {lessons.map((lesson) => {
                const unlocked = canAccessLesson(
                  paid,
                  lessons,
                  lesson.id,
                  progress.completedLessonIds,
                );
                const completed = progress.completedLessonIds.includes(lesson.id);
                const active = lesson.id === activeLessonId;

                return (
                  <li
                    key={lesson.id}
                    className={!unlocked ? 'course-learn-lesson-item-locked' : undefined}
                  >
                    <button
                      type="button"
                      className={`course-learn-lesson-btn${
                        active ? ' course-learn-lesson-active' : ''
                      }${completed ? ' course-learn-lesson-done' : ''}${
                        !unlocked ? ' course-learn-lesson-locked' : ''
                      }`}
                      disabled={!unlocked}
                      onClick={() => {
                        if (!unlocked) return;
                        setActiveLessonId(lesson.id);
                      }}
                    >
                      <span className="course-learn-lesson-icon" aria-hidden>
                        {completed ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : unlocked ? (
                          <PlayCircle className="h-4 w-4" />
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}
                      </span>
                      <span className="course-learn-lesson-text">
                        <span className="course-learn-lesson-name">{lesson.title}</span>
                        <span className="course-learn-lesson-meta">{lesson.duration}</span>
                      </span>
                      {!unlocked && <span className="course-learn-lock-label">Кулуп</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            <Link to="/courses" className="course-learn-back-courses">
              Курстарга өтүү
            </Link>
          </aside>

          <article className="course-learn-main ui-card">
            {!paid ? (
              <div className="courses-payment-block course-learn-payment">
                <p className="courses-payment-panel-label">Курсду активдештирүү</p>
                <h2 className="courses-payment-course-name">{course.title}</h2>
                <p className="courses-payment-course-desc">
                  Төлөгөндөн кийин 1-видеодон баштап, тест тапшырганда кийинкилер ачылат.
                </p>
                <CoursePaymentBlock
                  courseId={courseId}
                  courseTitle={course.title}
                  coursePrice={course.price}
                  lessonCount={course.lessons}
                  onPaid={handlePaid}
                />
              </div>
            ) : (
              <>
                <div className="course-learn-main-head">
                  <h2 className="course-learn-main-title">{activeLesson.title}</h2>
                  <span className="course-learn-main-step">
                    {activeLesson.order} / {course.lessons}
                  </span>
                </div>

                {!activeAccessible ? (
                  <div className="course-learn-locked-msg">
                    <Lock className="h-8 w-8" aria-hidden />
                    <p>Бул видео кулуп. Мурунку сабакты аяктаңыз.</p>
                  </div>
                ) : phase === 'video' ? (
                  <div className="course-learn-video-block">
                    <div className="course-learn-embed">
                      <iframe
                        key={activeLesson.id}
                        src={`https://www.youtube.com/embed/${activeLesson.videoId}?rel=0`}
                        title={activeLesson.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <p className="course-learn-video-hint">
                      Видеону толук көрүп бүткөндөн кийин тест ачылат.
                    </p>
                    <button
                      type="button"
                      className="btn-primary course-learn-video-btn"
                      disabled={!videoReady}
                      onClick={handleVideoComplete}
                    >
                      {videoReady ? 'Көрүү аяктады — тестке өтүү' : 'Видео көрүлүүдө...'}
                    </button>
                  </div>
                ) : phase === 'test' ? (
                  <div className="course-learn-test">
                    <h3 className="course-learn-test-title">Сабак боюнча тест</h3>
                    <div className="course-learn-test-scroll">
                      {activeLesson.tests.map((test, qIndex) => (
                        <fieldset key={test.question} className="course-learn-test-q">
                          <legend>{test.question}</legend>
                          <div className="course-learn-test-options">
                            {test.options.map((option, oIndex) => (
                              <label key={option} className="course-learn-test-option">
                                <input
                                  type="radio"
                                  name={`q-${qIndex}`}
                                  checked={answers[qIndex] === oIndex}
                                  onChange={() =>
                                    setAnswers((prev) => {
                                      const next = [...prev];
                                      next[qIndex] = oIndex;
                                      return next;
                                    })
                                  }
                                  disabled={testSubmitted && testPassed}
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ))}
                    </div>

                    {testSubmitted && !testPassed && (
                      <>
                        <p className="course-learn-test-fail">
                          80% дан жогору топтоңуз. Видеону кайра көрүп, тестти кайра тапшырыңыз.
                        </p>
                        <button
                          type="button"
                          className="btn-primary course-learn-test-btn"
                          onClick={() => {
                            setPhase('video');
                            setTestSubmitted(false);
                            setAnswers([]);
                          }}
                        >
                          Кайра баштоо
                        </button>
                      </>
                    )}

                    {testPassed ? (
                      <p className="course-learn-test-pass">
                        <CheckCircle2 className="h-4 w-4 inline" /> Тест ийгиликтүү! Кийинки видео ачылды.
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="btn-gold course-learn-test-btn"
                        onClick={handleTestSubmit}
                        disabled={answers.some((a) => a < 0)}
                      >
                        Тестти тапшыруу
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="course-learn-review">
                    <div className="course-learn-review-success">
                      <CheckCircle2 className="h-5 w-5" aria-hidden />
                      <span>Сабак аякталды — кайра көрө аласыз</span>
                    </div>

                    <div className="course-learn-review-tabs">
                      <button
                        type="button"
                        className={`course-learn-review-tab${
                          reviewTab === 'video' ? ' course-learn-review-tab-active' : ''
                        }`}
                        onClick={() => setReviewTab('video')}
                      >
                        Видео
                      </button>
                      <button
                        type="button"
                        className={`course-learn-review-tab${
                          reviewTab === 'test' ? ' course-learn-review-tab-active' : ''
                        }`}
                        onClick={() => setReviewTab('test')}
                      >
                        Тест
                      </button>
                    </div>

                    {reviewTab === 'video' ? (
                      <div className="course-learn-video-block">
                        <div className="course-learn-embed">
                          <iframe
                            key={`review-${activeLesson.id}`}
                            src={`https://www.youtube.com/embed/${activeLesson.videoId}?rel=0`}
                            title={activeLesson.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                        <p className="course-learn-video-hint">
                          Видеону каалаган убакта кайra көрүңүз.
                        </p>
                      </div>
                    ) : (
                      <div className="course-learn-test course-learn-test-review">
                        <h3 className="course-learn-test-title">Тест — кайra көрүү</h3>
                        <div className="course-learn-test-scroll">
                          {activeLesson.tests.map((test) => (
                            <div key={test.question} className="course-learn-test-q course-learn-test-q-review">
                              <p className="course-learn-test-q-text">{test.question}</p>
                              <ul className="course-learn-test-review-list">
                                {test.options.map((option, oIndex) => (
                                  <li
                                    key={option}
                                    className={`course-learn-test-review-option${
                                      oIndex === test.correctIndex
                                        ? ' course-learn-test-review-correct'
                                        : ''
                                    }`}
                                  >
                                    {option}
                                    {oIndex === test.correctIndex && (
                                      <span className="course-learn-test-review-mark">✓ Туура</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const next = lessons.find(
                        (l) =>
                          canAccessLesson(paid, lessons, l.id, progress.completedLessonIds) &&
                          !progress.completedLessonIds.includes(l.id),
                      );
                      if (!next) {
                        return (
                          <p className="course-learn-done-all">Бардык видеолор аякталды!</p>
                        );
                      }
                      return (
                        <button
                          type="button"
                          className="btn-gold course-learn-next-btn"
                          onClick={() => setActiveLessonId(next.id)}
                        >
                          Кийинки видео: {next.order}-сабак
                        </button>
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
