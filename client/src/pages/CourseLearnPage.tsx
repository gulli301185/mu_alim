import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Lock,
  PlayCircle,
} from 'lucide-react';
import {
  getCourseById,
  isLessonUnlocked,
  mapLessonsToCourseLessons,
  type CourseLesson,
} from '../data/courseLessons';
import { SITE } from '../data/landing';
import { getLessonsByCourse } from '../lib/lesson-api';
import {
  downloadCourseCertificate,
  generateCertificateNumber,
  loadCertificateName,
  saveCertificateName,
  SITE_LOGO_URL,
} from '../lib/certificatePdf';
import {
  calcTestScorePercent,
  CERTIFICATE_THRESHOLD,
  ensureCertificateMeta,
  getAverageScore,
  isCertificateEligible,
  isCoursePaid,
  loadCourseProgress,
  markLessonComplete,
  PASS_THRESHOLD,
  type CourseProgress,
} from '../lib/courseAccess';
import { CourseYoutubePlayer } from '../components/CourseYoutubeLink';

type LessonPhase = 'video' | 'test' | 'review';
type ReviewTab = 'video' | 'test';

function canAccessLesson(
  paid: boolean,
  lessons: CourseLesson[],
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

  const {
    data: apiLessons,
    isLoading: lessonsLoading,
    isError: lessonsIsError,
    error: lessonsQueryError,
  } = useQuery({
    queryKey: ['course-lessons', courseId],
    queryFn: () => getLessonsByCourse(courseId!),
    enabled: Boolean(courseId && course),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const lessons = useMemo(
    () => (apiLessons && course ? mapLessonsToCourseLessons(apiLessons, course.title) : []),
    [apiLessons, course?.title],
  );

  const lessonIdsKey = useMemo(() => lessons.map((lesson) => lesson.id).join(','), [lessons]);

  const [paid, setPaid] = useState(() => (courseId ? isCoursePaid(courseId) : false));
  const [progress, setProgress] = useState<CourseProgress>(() =>
    courseId ? loadCourseProgress(courseId) : { completedLessonIds: [] },
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [phase, setPhase] = useState<LessonPhase>('video');
  const [videoWatched, setVideoWatched] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [lastTestScore, setLastTestScore] = useState<number | null>(null);
  const [reviewTab, setReviewTab] = useState<ReviewTab>('video');
  const [certificateName, setCertificateName] = useState(() => loadCertificateName());

  useEffect(() => {
    if (!courseId || !course) {
      navigate('/courses', { replace: true });
      return;
    }
    if (!isCoursePaid(courseId)) {
      navigate(`/courses/${courseId}`, { replace: true });
      return;
    }
    setPaid(true);
    setProgress((prev) => {
      const loaded = loadCourseProgress(courseId);
      if (
        prev.completedLessonIds.length === loaded.completedLessonIds.length &&
        prev.completedLessonIds.every((id, index) => id === loaded.completedLessonIds[index])
      ) {
        return prev;
      }
      return loaded;
    });
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
  }, [lessonIdsKey, lessons, progress.completedLessonIds, paid]);

  useEffect(() => {
    setAnswers([]);
    setTestSubmitted(false);
    setVideoWatched(false);

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
  }, [activeLessonId, lessonIdsKey, lessons, progress.completedLessonIds, paid]);

  const handleWatchComplete = useCallback(() => {
    setVideoWatched(true);
  }, []);

  const activeLesson = lessons.find((l) => l.id === activeLessonId);
  const completedCount = progress.completedLessonIds.length;
  const activeAccessible = activeLesson
    ? canAccessLesson(paid, lessons, activeLesson.id, progress.completedLessonIds)
    : false;

  const handleVideoComplete = () => {
    if (!videoWatched || !activeAccessible) return;
    setPhase('test');
    setAnswers(activeLesson?.tests.map(() => -1) ?? []);
    setTestSubmitted(false);
  };

  const handleTestSubmit = () => {
    if (!activeLesson || !courseId || !activeAccessible) return;
    if (answers.some((a) => a < 0)) return;

    setTestSubmitted(true);
    const correct = activeLesson.tests.filter((t, i) => answers[i] === t.correctIndex).length;
    const scorePercent = calcTestScorePercent(correct, activeLesson.tests.length);
    const passed = scorePercent / 100 >= PASS_THRESHOLD;

    setLastTestScore(scorePercent);

    if (passed) {
      const next = markLessonComplete(courseId, activeLesson.id, scorePercent);
      setProgress(next);
      setPhase('review');
      setReviewTab('video');
    }
  };

  const handleCertificateDownload = async () => {
    if (!courseId || !course) return;

    const trimmedName = certificateName.trim();
    if (!trimmedName) return;

    saveCertificateName(trimmedName);

    const lessonIds = lessons.map((lesson) => lesson.id);
    const average = getAverageScore(progress, lessonIds) ?? 0;
    const certificateNumber =
      progress.certificateNumber ?? generateCertificateNumber(courseId);

    if (!progress.certificateNumber) {
      const next = ensureCertificateMeta(courseId, certificateNumber);
      setProgress(next);
    }

    await downloadCourseCertificate({
      studentName: trimmedName,
      courseTitle: course.title,
      scorePercent: average,
      issuedAt: new Date(),
      certificateNumber,
    });
  };


  const lessonIds = useMemo(() => lessons.map((lesson) => lesson.id), [lessons]);
  const averageScore = getAverageScore(progress, lessonIds);
  const certificateReady = isCertificateEligible(progress, lessons.length, lessonIds);
  const allLessonsDone = progress.completedLessonIds.length >= lessons.length;

  const lessonCount = lessons.length || course?.lessons || 0;

  if (!course || !courseId) {
    return null;
  }

  if (lessonsLoading) {
    return (
      <section className="course-learn-page">
        <div className="wrap course-learn-inner">
          <p className="course-learn-stats">Сабактар жүктөлүүдө...</p>
        </div>
      </section>
    );
  }

  if (lessonsIsError) {
    const message =
      lessonsQueryError instanceof Error && lessonsQueryError.message === 'Курс табылган жок'
        ? 'Бул курс базада табылган жок. Админге кайрылыңыз.'
        : 'Сабактар жүктөлбөдү. Кийинчерээк кайра аракет кылыңыз.';
    return (
      <section className="course-learn-page">
        <div className="wrap course-learn-inner">
          <Link to={`/courses/${courseId}`} className="course-learn-back">
            <ArrowLeft className="h-4 w-4" />
            Курска кайтуу
          </Link>
          <p className="course-learn-stats">{message}</p>
        </div>
      </section>
    );
  }

  if (!lessons.length) {
    return (
      <section className="course-learn-page">
        <div className="wrap course-learn-inner">
          <Link to={`/courses/${courseId}`} className="course-learn-back">
            <ArrowLeft className="h-4 w-4" />
            Курска кайтуу
          </Link>
          <p className="course-learn-stats">Бул курс үчүн жарыяланган сабактар табылган жок.</p>
        </div>
      </section>
    );
  }

  if (!activeLesson) {
    return (
      <section className="course-learn-page">
        <div className="wrap course-learn-inner">
          <p className="course-learn-stats">Сабактар жүктөлүүдө...</p>
        </div>
      </section>
    );
  }

  const testPassed = testSubmitted && (lastTestScore ?? 0) / 100 >= PASS_THRESHOLD;
  const testScoreHigh = testSubmitted && (lastTestScore ?? 0) / 100 >= CERTIFICATE_THRESHOLD;

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
              {lessonCount} видео-сабак · {completedCount} аякталды ·{' '}
              {lessonCount - completedCount} калды
            </p>
          </div>
        </div>

        <div className="course-learn-grid">
          <aside className="course-learn-sidebar ui-card">
            <h2 className="course-learn-sidebar-title">
              Видеолор ({lessonCount})
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
                        if (
                          !completed &&
                          activeLessonId &&
                          activeLessonId !== lesson.id &&
                          !progress.completedLessonIds.includes(activeLessonId)
                        ) {
                          return;
                        }
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
            <>
                <div className="course-learn-main-head">
                  <h2 className="course-learn-main-title">{activeLesson.title}</h2>
                  <span className="course-learn-main-step">
                    {activeLesson.order} / {lessonCount}
                  </span>
                </div>

                {!activeAccessible ? (
                  <div className="course-learn-locked-msg">
                    <Lock className="h-8 w-8" aria-hidden />
                    <p>Бул видео кулуп. Мурунку сабакты аяктаңыз.</p>
                  </div>
                ) : phase === 'video' ? (
                  <div className="course-learn-video-block">
                    <CourseYoutubePlayer
                      key={activeLesson.id}
                      videoId={activeLesson.videoId}
                      title={activeLesson.title}
                      onWatchComplete={handleWatchComplete}
                      requireFullWatch
                    />
                    <p className="course-learn-video-hint">
                      Токтотуп коё аласыз, бирок видеону аягына чейин көрүшүңүз керек. Андан кийин тест ачылат.
                    </p>
                    <button
                      type="button"
                      className="btn-primary course-learn-video-btn"
                      disabled={!videoWatched}
                      onClick={handleVideoComplete}
                    >
                      {videoWatched ? 'Көрүү аяктады — тестке өтүү' : 'Видеону аягына чейин көрүңүз...'}
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
                            setVideoWatched(false);
                          }}
                        >
                          Кайра баштоо
                        </button>
                      </>
                    )}

                    {testPassed ? (
                      <div className="course-learn-test-pass-wrap">
                        <p className="course-learn-test-pass">
                          <CheckCircle2 className="h-4 w-4 inline" /> Тест ийгиликтүү! ({lastTestScore}
                          %) Кийинки видео ачылды.
                        </p>
                        {testScoreHigh && !allLessonsDone && (
                          <p className="course-learn-test-cert-hint">
                            90% жана жогору! Курс аяктаганда сертификат ала аласыз.
                          </p>
                        )}
                      </div>
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
                        <CourseYoutubePlayer
                          key={`review-${activeLesson.id}`}
                          videoId={activeLesson.videoId}
                          title={activeLesson.title}
                          requireFullWatch={false}
                        />
                        <p className="course-learn-video-hint">
                          Видеону каалаган убакта кайра көрүңүз.
                        </p>
                      </div>
                    ) : (
                      <div className="course-learn-test course-learn-test-review">
                        <h3 className="course-learn-test-title">Тест — кайра көрүү</h3>
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
                          <div className="course-learn-done">
                            <img
                              src={SITE_LOGO_URL}
                              alt={SITE.name}
                              className="course-learn-done-logo"
                            />
                            <p className="course-learn-done-all">Бардык видеолор аякталды!</p>
                            {certificateReady ? (
                              <>
                                <p className="course-learn-done-title">Сертификатка укук ачылды!</p>
                                <p className="course-learn-done-text">
                                  Орточо көрсөткүч: {averageScore}% (минимум{' '}
                                  {CERTIFICATE_THRESHOLD * 100}%)
                                </p>
                                <label className="course-learn-cert-name-field">
                                  <span className="course-learn-cert-name-label">Атыңыз</span>
                                  <input
                                    type="text"
                                    className="course-learn-cert-name-input"
                                    value={certificateName}
                                    onChange={(e) => setCertificateName(e.target.value)}
                                    placeholder="Сертификатка жазылуу"
                                  />
                                </label>
                                <button
                                  type="button"
                                  className="btn-gold course-learn-cert-btn"
                                  onClick={handleCertificateDownload}
                                  disabled={!certificateName.trim()}
                                >
                                  <Download className="h-4 w-4" aria-hidden />
                                  ПДФ сертификатты жүктөө
                                </button>
                              </>
                            ) : (
                              <p className="course-learn-done-text">
                                Сертификат үчүн бардык тесттерде орточо {CERTIFICATE_THRESHOLD * 100}%
                                же жогору керек. Азыркы орточо: {averageScore ?? 0}%
                              </p>
                            )}
                          </div>
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
          </article>
        </div>
      </div>
    </section>
  );
}
