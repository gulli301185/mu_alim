import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Lock,
  PlayCircle,
} from 'lucide-react';
import {
  CERTIFICATE_THRESHOLD,
  ensureCertificateMeta,
  isCertificateEligible,
  isCoursePaid,
  loadCourseProgress,
  markFinalTestResult,
  markLessonComplete,
  PASS_THRESHOLD,
  type CourseProgress,
} from '../lib/courseAccess';
import { fetchCourseByRef, isFreeCourse } from '../lib/course-api';
import { CourseYoutubePlayer } from '../components/CourseYoutubeLink';
import {
  isLessonUnlocked,
  mapLessonsToCourseLessons,
  type CourseLesson,
} from '../data/courseLessons';
import { SITE } from '../data/landing';
import { getLessonsByCourse } from '../lib/lesson-api';
import {
  fetchCourseFinalTest,
  gradeCourseFinalTest,
  type CourseTestPayload,
  type GradeTestResult,
} from '../lib/test-api';
import {
  downloadCourseCertificate,
  generateCertificateNumber,
  loadCertificateName,
  saveCertificateName,
  SITE_LOGO_URL,
} from '../lib/certificatePdf';
import { toastError } from '../lib/toast';

type LessonPhase = 'video' | 'review';
type ViewMode = 'lesson' | 'final-test';

function canAccessLesson(
  isFree: boolean,
  paid: boolean,
  lessons: CourseLesson[],
  lessonId: string,
  completedLessonIds: string[],
) {
  if (!isFree && !paid) return false;
  if (completedLessonIds.includes(lessonId)) return true;
  return isLessonUnlocked(lessons, lessonId, completedLessonIds);
}

export function CourseLearnPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const lessonFromQuery = searchParams.get('lesson');
  const navigate = useNavigate();

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => fetchCourseByRef(courseId!),
    enabled: Boolean(courseId),
  });

  const isFree = course ? isFreeCourse(course) : false;

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
  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, string>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [lastTestScore, setLastTestScore] = useState<number | null>(null);
  const [gradeResult, setGradeResult] = useState<GradeTestResult | null>(null);
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('lesson');
  const [certificateName, setCertificateName] = useState(() => loadCertificateName());

  useEffect(() => {
    if (!courseId || courseLoading) return;
    if (!course) {
      navigate('/courses', { replace: true });
      return;
    }
    const hasAccess = isFree || isCoursePaid(courseId);
    if (!hasAccess) {
      navigate(`/courses/${courseId}`, { replace: true });
      return;
    }
    setPaid(hasAccess && !isFree);
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
  }, [courseId, course, courseLoading, isFree, navigate]);

  useEffect(() => {
    if (!lessons.length) return;

    if (
      lessonFromQuery &&
      lessons.some((l) => l.id === lessonFromQuery) &&
      canAccessLesson(isFree, paid, lessons, lessonFromQuery, progress.completedLessonIds)
    ) {
      setActiveLessonId(lessonFromQuery);
      return;
    }

    if (!paid && !isFree) {
      setActiveLessonId(lessons[0].id);
      return;
    }

    const firstOpen =
      lessons.find((l) => canAccessLesson(isFree, paid, lessons, l.id, progress.completedLessonIds)) ??
      lessons[0];

    setActiveLessonId((prev) => {
      if (prev && canAccessLesson(isFree, paid, lessons, prev, progress.completedLessonIds)) return prev;
      return firstOpen.id;
    });
  }, [lessonIdsKey, lessons, progress.completedLessonIds, paid, isFree, lessonFromQuery]);

  useEffect(() => {
    setTestSubmitted(false);
    setVideoWatched(false);
    setChoiceAnswers({});
    setTextAnswers({});
    setGradeResult(null);
    setLastTestScore(null);

    if (!activeLessonId || !lessons.length) return;

    const lesson = lessons.find((l) => l.id === activeLessonId);
    if (!lesson) return;

    if (!canAccessLesson(isFree, paid, lessons, lesson.id, progress.completedLessonIds)) {
      setPhase('video');
      return;
    }

    if (progress.completedLessonIds.includes(lesson.id)) {
      setPhase('review');
      return;
    }

    setPhase('video');
  }, [activeLessonId, lessonIdsKey, lessons, progress.completedLessonIds, paid, isFree]);

  const handleWatchComplete = useCallback(() => {
    setVideoWatched(true);
  }, []);

  const activeLesson = lessons.find((l) => l.id === activeLessonId);
  const completedCount = progress.completedLessonIds.length;
  const activeAccessible = activeLesson
    ? canAccessLesson(isFree, paid, lessons, activeLesson.id, progress.completedLessonIds)
    : false;

  const { data: courseFinalTest, isLoading: courseFinalTestLoading } = useQuery({
    queryKey: ['course-final-test', courseId],
    queryFn: () => fetchCourseFinalTest(courseId!),
    enabled: Boolean(courseId && !isFree && paid),
  });

  const allTestQuestionsAnswered = useMemo(() => {
    if (!courseFinalTest?.questions.length) return false;
    return courseFinalTest.questions.every((question) => {
      if (question.questionType === 'choice') {
        return Boolean(choiceAnswers[question.id]);
      }
      return Boolean(textAnswers[question.id]?.trim());
    });
  }, [courseFinalTest, choiceAnswers, textAnswers]);

  const handleVideoComplete = () => {
    if (!videoWatched || !activeAccessible || !activeLesson || !courseId) return;

    const next = markLessonComplete(courseId, activeLesson.id);
    setProgress(next);
    setPhase('review');

    const allDone = next.completedLessonIds.length >= lessons.length;
    if (!isFree && allDone && courseFinalTest && !next.finalTestPassed) {
      setViewMode('final-test');
      setChoiceAnswers({});
      setTextAnswers({});
      setGradeResult(null);
      setTestSubmitted(false);
      setLastTestScore(null);
    }
  };

  const handleFinalTestSubmit = async () => {
    if (!courseId || !courseFinalTest || !allTestQuestionsAnswered) return;

    setTestSubmitting(true);
    try {
      const payload = courseFinalTest.questions.map((question) => ({
        questionId: question.id,
        selectedOptionId:
          question.questionType === 'choice' ? choiceAnswers[question.id] : undefined,
        textAnswer: question.questionType === 'text' ? textAnswers[question.id]?.trim() : undefined,
      }));

      const result = await gradeCourseFinalTest(courseId, payload);
      setGradeResult(result);
      setTestSubmitted(true);
      setLastTestScore(result.scorePercent);

      const next = markFinalTestResult(courseId, result.passed, result.scorePercent);
      setProgress(next);
    } catch {
      toastError('Тест тапшырылган жок. Кайра аракет кылыңыз.');
    } finally {
      setTestSubmitting(false);
    }
  };

  const handleCertificateDownload = async () => {
    if (!courseId || !course) return;

    const trimmedName = certificateName.trim();
    if (!trimmedName) return;

    saveCertificateName(trimmedName);

    const score = progress.finalTestScore ?? 0;
    const certificateNumber =
      progress.certificateNumber ?? generateCertificateNumber(courseId);

    if (!progress.certificateNumber) {
      const next = ensureCertificateMeta(courseId, certificateNumber);
      setProgress(next);
    }

    await downloadCourseCertificate({
      studentName: trimmedName,
      courseTitle: course.title,
      scorePercent: score,
      issuedAt: new Date(),
      certificateNumber,
    });
  };


  const allLessonsDone = progress.completedLessonIds.length >= lessons.length;
  const certificateReady = isCertificateEligible(progress, lessons.length);
  const finalTestPassed = Boolean(progress.finalTestPassed);

  const lessonCount = lessons.length || course?.lessonCount || 0;

  if (courseLoading || !courseId) {
    return (
      <section className="course-learn-page">
        <div className="wrap course-learn-inner">
          <p className="course-learn-stats">Жүктөлүүдө...</p>
        </div>
      </section>
    );
  }

  if (!course) {
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

  const testPassed = Boolean(gradeResult?.passed ?? progress.finalTestPassed);
  const passingScoreLabel = courseFinalTest?.passingScore ?? PASS_THRESHOLD * 100;

  const renderFinalTestPanel = (test: CourseTestPayload) => (
    <div className="course-learn-test">
      <h3 className="course-learn-test-title">{test.title}</h3>
      <p className="course-learn-video-hint">
        Бардык сабактар аяктады. Курстук финалдык тестти тапшырыңыз — ийгиликтүү болсо сертификат аласыз.
      </p>
      <div className="course-learn-test-scroll">
        {test.questions.map((question, qIndex) => (
          <fieldset key={question.id} className="course-learn-test-q">
            <legend>
              {qIndex + 1}. {question.questionText}
            </legend>
            {question.questionType === 'choice' && question.options ? (
              <div className="course-learn-test-options">
                {question.options.map((option) => (
                  <label key={option.id} className="course-learn-test-option">
                    <input
                      type="radio"
                      name={`final-q-${question.id}`}
                      checked={choiceAnswers[question.id] === option.id}
                      onChange={() =>
                        setChoiceAnswers((prev) => ({ ...prev, [question.id]: option.id }))
                      }
                      disabled={testSubmitted && testPassed}
                    />
                    <span>
                      {option.label}) {option.optionText}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type="text"
                className="course-learn-test-text-input qa-admin-input"
                value={textAnswers[question.id] ?? ''}
                onChange={(e) =>
                  setTextAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                }
                placeholder="Жообуңузду жазыңыз"
                disabled={testSubmitted && testPassed}
              />
            )}
          </fieldset>
        ))}
      </div>

      {testSubmitted && !testPassed && (
        <>
          <p className="course-learn-test-fail">
            {passingScoreLabel}% дан жогору топтоңуз ({lastTestScore ?? 0}%). Кайра аракет кылыңыз.
          </p>
          <button
            type="button"
            className="btn-primary course-learn-test-btn"
            onClick={() => {
              setTestSubmitted(false);
              setChoiceAnswers({});
              setTextAnswers({});
              setGradeResult(null);
            }}
          >
            Кайра тапшыруу
          </button>
        </>
      )}

      {testPassed ? (
        <div className="course-learn-test-pass-wrap">
          <p className="course-learn-test-pass">
            <CheckCircle2 className="h-4 w-4 inline" /> Курстук тест ийгиликтүү! ({lastTestScore ?? progress.finalTestScore}%)
          </p>
          {certificateReady ? (
            <div className="course-learn-done course-learn-done-inline">
              <p className="course-learn-test-cert-hint">Сертификатты жүктөп ала аласыз!</p>
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
                onClick={() => void handleCertificateDownload()}
                disabled={!certificateName.trim()}
              >
                <Download className="h-4 w-4" aria-hidden />
                ПДФ сертификатты жүктөө
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          className="btn-gold course-learn-test-btn"
          onClick={() => void handleFinalTestSubmit()}
          disabled={!allTestQuestionsAnswered || testSubmitting}
        >
          {testSubmitting ? 'Текшерилүүдө...' : 'Курстук тестти тапшыруу'}
        </button>
      )}
    </div>
  );

  return (
    <section className="course-learn-page">
      <div className="wrap course-learn-inner">
        <div className="course-learn-head">
          <Link to={isFree ? '/courses/free' : '/courses'} className="course-learn-back">
            <ArrowLeft className="h-4 w-4" />
            {isFree ? 'Бекер курстарга' : 'Курстарга'} кайтуу
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
                  isFree,
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

            {!isFree && allLessonsDone && courseFinalTest && !finalTestPassed ? (
              <div className="course-learn-sidebar-final-test">
                <button
                  type="button"
                  className={`btn-gold course-learn-final-test-nav${
                    viewMode === 'final-test' ? ' course-learn-final-test-nav-active' : ''
                  }`}
                  onClick={() => {
                    setViewMode('final-test');
                    setChoiceAnswers({});
                    setTextAnswers({});
                    setGradeResult(null);
                    setTestSubmitted(false);
                    setLastTestScore(null);
                  }}
                >
                  Курстук финалдык тест
                </button>
              </div>
            ) : null}

            <Link to={isFree ? '/courses/free' : '/courses'} className="course-learn-back-courses">
              {isFree ? 'Бекер курстарга өтүү' : 'Курстарга өтүү'}
            </Link>
          </aside>

          <article className="course-learn-main ui-card">
            {viewMode === 'final-test' && courseFinalTest ? (
              <>
                <div className="course-learn-main-head">
                  <h2 className="course-learn-main-title">Курстук финалдык тест</h2>
                  <button
                    type="button"
                    className="course-learn-back-to-lessons"
                    onClick={() => setViewMode('lesson')}
                  >
                    Сабактарга кайтуу
                  </button>
                </div>
                {courseFinalTestLoading ? (
                  <p className="course-learn-stats">Тест жүктөлүүдө...</p>
                ) : (
                  renderFinalTestPanel(courseFinalTest)
                )}
              </>
            ) : (
              <>
                <div className="course-learn-main-head">
                  <div className="course-learn-main-heading">
                    <h2 className="course-learn-main-title">{activeLesson.title}</h2>
                    <p className="course-learn-main-author">Сабактын автору Мухаммадалим Халил</p>
                  </div>
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
                    <p className="course-learn-video-hint">Видеону аягына чейин көрүңүз.</p>
                    <button
                      type="button"
                      className="btn-primary course-learn-video-btn"
                      disabled={!videoWatched}
                      onClick={handleVideoComplete}
                    >
                      {!videoWatched ? 'Видеону аягына чейин көрүңүз...' : 'Көрүү аяктады — улантуу'}
                    </button>
                  </div>
                ) : (
                  <div className="course-learn-review">
                    <div className="course-learn-review-success">
                      <CheckCircle2 className="h-5 w-5" aria-hidden />
                      <span>Сабак аякталды — кайра көрө аласыз</span>
                    </div>

                    <div className="course-learn-video-block">
                      <CourseYoutubePlayer
                        key={`review-${activeLesson.id}`}
                        videoId={activeLesson.videoId}
                        title={activeLesson.title}
                        requireFullWatch={false}
                      />
                      <p className="course-learn-video-hint">Видеону каалаган убакта кайра көрүңүз.</p>
                    </div>

                    {(() => {
                      const next = lessons.find(
                        (l) =>
                          canAccessLesson(isFree, paid, lessons, l.id, progress.completedLessonIds) &&
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
                            {!isFree && courseFinalTest && !finalTestPassed ? (
                              <>
                                <p className="course-learn-done-text">
                                  Сертификат алуу үчүн курстук финалдык тестти тапшырыңыз.
                                </p>
                                <button
                                  type="button"
                                  className="btn-gold course-learn-next-btn"
                                  onClick={() => setViewMode('final-test')}
                                >
                                  Курстук тестке өтүү
                                </button>
                              </>
                            ) : certificateReady ? (
                              <>
                                <p className="course-learn-done-title">Сертификатка укук ачылды!</p>
                                <p className="course-learn-done-text">
                                  Курстук тест: {progress.finalTestScore ?? 0}% (минимум{' '}
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
                                  onClick={() => void handleCertificateDownload()}
                                  disabled={!certificateName.trim()}
                                >
                                  <Download className="h-4 w-4" aria-hidden />
                                  ПДФ сертификатты жүктөө
                                </button>
                              </>
                            ) : isFree ? (
                              <p className="course-learn-done-text">Курс ийгиликтүү аяктады!</p>
                            ) : (
                              <p className="course-learn-done-text">
                                Сертификат үчүн курстук тестти ийгиликтүү тапшыруу керек.
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
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
