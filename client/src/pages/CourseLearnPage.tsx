import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  loadCourseProgress,
  markFinalTestResult,
  markLessonComplete,
  PASS_THRESHOLD,
  saveCourseProgress,
  type CourseProgress,
} from '../lib/courseAccess';
import { useAuth } from '../context/AuthContext';
import { useCourseEnrollment } from '../hooks/useMyEnrollments';
import { completeCourseLesson, fetchCourseProgress, syncCourseProgress } from '../lib/course-progress-api';
import { fetchCourseByRef, isFreeCourse } from '../lib/course-api';
import { CourseYoutubePlayer } from '../components/CourseYoutubeLink';
import {
  isLessonUnlocked,
  mapLessonsToCourseLessons,
  getFirstUnlockedLessonId,
  resolveCompletedLessonIds,
  type CourseLesson,
} from '../data/courseLessons';
import { SITE } from '../data/landing';
import { getLessonsByCourse } from '../lib/lesson-api';
import {
  fetchCourseFinalTest,
  gradeCourseFinalTest,
  TestLockedError,
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
import { youtubeThumbnail, youtubeWatchUrl } from '../lib/youtube';
import { toastError } from '../lib/toast';
import { CourseReviewsSection } from '../components/CourseReviews';

type ViewMode = 'lesson' | 'final-test';

function formatTestLockUntil(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function canAccessLesson(
  lessons: CourseLesson[],
  lessonId: string,
  completedLessonIds: string[],
) {
  if (completedLessonIds.includes(lessonId)) return true;
  return isLessonUnlocked(lessons, lessonId, completedLessonIds);
}

function openYoutubeLesson(videoId: string) {
  window.open(youtubeWatchUrl(videoId), '_blank', 'noopener,noreferrer');
}

function FreeYoutubeEmbed({ videoId, title }: { videoId: string; title: string }) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
  }, [videoId]);

  if (!playing) {
    return (
      <button
        type="button"
        className="course-learn-embed course-learn-free-embed courses-free-watch course-learn-free-preview"
        onClick={() => setPlaying(true)}
        aria-label={`${title} — сайтта ойнотуу`}
      >
        <img src={youtubeThumbnail(videoId)} alt="" className="course-learn-free-preview-img" />
        <span className="course-learn-free-preview-play" aria-hidden>
          <PlayCircle className="h-16 w-16" fill="currentColor" />
        </span>
      </button>
    );
  }

  return (
    <div className="course-learn-embed course-learn-free-embed courses-free-watch">
      <iframe
        key={`${videoId}-playing`}
        src={`https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
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

  const { token, user } = useAuth();
  const { enrolled, isLoading: enrollmentLoading } = useCourseEnrollment(
    course ? { id: course.id, slug: course.slug, recordId: course.recordId } : null,
  );
  const hasAccess = isFree || enrolled;
  const progressUserId = user?.id ?? null;
  const progressAliases = useMemo(
    () =>
      course
        ? [course.id, course.slug, course.recordId].filter((value): value is string => Boolean(value))
        : [],
    [course],
  );
  const syncedProgressRef = useRef<string>('');

  const {
    data: apiLessons,
    isLoading: lessonsLoading,
    isError: lessonsIsError,
    error: lessonsQueryError,
  } = useQuery({
    queryKey: ['course-lessons', courseId, hasAccess ? 'open' : 'locked'],
    queryFn: () => getLessonsByCourse(courseId!, token),
    enabled: Boolean(courseId && course && hasAccess),
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

  const { data: serverProgress } = useQuery({
    queryKey: ['course-progress', courseId, progressUserId],
    queryFn: () => fetchCourseProgress(courseId!, token!),
    enabled: Boolean(courseId && token && progressUserId && hasAccess && !isFree),
    staleTime: 10_000,
  });

  const lessonIdsKey = useMemo(() => lessons.map((lesson) => lesson.id).join(','), [lessons]);

  const [progress, setProgress] = useState<CourseProgress>(() =>
    courseId ? loadCourseProgress(courseId, progressUserId) : { completedLessonIds: [] },
  );
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
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
    if (!courseId || courseLoading || enrollmentLoading) return;
    if (!course) {
      navigate('/courses', { replace: true });
      return;
    }
    if (!hasAccess) {
      navigate(`/courses/${courseId}`, { replace: true });
      return;
    }
    const local = loadCourseProgress(courseId, progressUserId, {
      aliases: progressAliases,
      adoptLegacy: !isFree,
    });
    const storedIds = [
      ...local.completedLessonIds,
      ...(serverProgress?.completedLessonIds ?? []),
    ];
    const completedLessonIds = lessons.length
      ? resolveCompletedLessonIds(lessons, storedIds)
      : [...new Set(storedIds)];
    const next = { ...local, completedLessonIds };
    saveCourseProgress(courseId, next, progressUserId);
    setProgress(next);

    if (
      !isFree &&
      token &&
      serverProgress &&
      lessons.length &&
      completedLessonIds.length > serverProgress.completedLessonIds.length
    ) {
      const syncKey = `${progressUserId}:${courseId}:${completedLessonIds.join(',')}`;
      if (syncedProgressRef.current !== syncKey) {
        syncedProgressRef.current = syncKey;
        void syncCourseProgress(courseId, completedLessonIds, token).catch(() => {
          syncedProgressRef.current = '';
        });
      }
    }
  }, [
    courseId,
    course,
    courseLoading,
    enrollmentLoading,
    hasAccess,
    navigate,
    progressUserId,
    progressAliases,
    serverProgress,
    isFree,
    token,
    lessons,
  ]);

  useEffect(() => {
    if (!lessons.length) return;

    if (isFree) {
      const selected =
        lessonFromQuery && lessons.some((l) => l.id === lessonFromQuery)
          ? lessonFromQuery
          : lessons[0].id;
      setActiveLessonId(selected);
      return;
    }

    const completedIds = progress.completedLessonIds;
    const firstOpenId = getFirstUnlockedLessonId(lessons, completedIds) ?? lessons[0].id;

    if (
      lessonFromQuery &&
      lessons.some((l) => l.id === lessonFromQuery) &&
      canAccessLesson(lessons, lessonFromQuery, completedIds)
    ) {
      setActiveLessonId(lessonFromQuery);
      return;
    }

    if (lessonFromQuery && !canAccessLesson(lessons, lessonFromQuery, completedIds)) {
      navigate(`/courses/${courseId}/learn`, { replace: true });
    }

    setActiveLessonId((prev) => {
      if (prev && canAccessLesson(lessons, prev, completedIds)) return prev;
      return firstOpenId;
    });
  }, [lessonIdsKey, lessons, progress.completedLessonIds, lessonFromQuery, courseId, navigate, isFree]);

  useEffect(() => {
    if (isFree) return;
    setTestSubmitted(false);
    setVideoWatched(false);
    setChoiceAnswers({});
    setTextAnswers({});
    setGradeResult(null);
    setLastTestScore(null);

    if (!activeLessonId || !lessons.length) return;

    const lesson = lessons.find((l) => l.id === activeLessonId);
    if (!lesson) return;

    if (!canAccessLesson(lessons, lesson.id, progress.completedLessonIds)) {
      return;
    }

    if (progress.completedLessonIds.includes(lesson.id)) {
      setVideoWatched(true);
      return;
    }

    setVideoWatched(false);
  }, [activeLessonId, lessonIdsKey, lessons, progress.completedLessonIds, isFree]);

  const handleWatchComplete = useCallback(() => {
    setVideoWatched(true);
  }, []);

  const activeLesson = lessons.find((l) => l.id === activeLessonId);
  const completedCount = progress.completedLessonIds.length;
  const isActiveLessonCompleted = activeLesson
    ? progress.completedLessonIds.includes(activeLesson.id)
    : false;
  const activeAccessible = activeLesson
    ? canAccessLesson(lessons, activeLesson.id, progress.completedLessonIds)
    : false;

  const { data: courseFinalTest, isLoading: courseFinalTestLoading, refetch: refetchFinalTest } = useQuery({
    queryKey: ['course-final-test', courseId, progressUserId],
    queryFn: () => fetchCourseFinalTest(courseId!, token),
    enabled: Boolean(courseId && course && !isFree),
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
    if (!videoWatched || !activeAccessible || !activeLesson || !courseId || isActiveLessonCompleted) return;

    const next = markLessonComplete(courseId, activeLesson.id, undefined, progressUserId);
    setProgress(next);
    setVideoWatched(true);
    if (token && !isFree) {
      void completeCourseLesson(courseId, activeLesson.id, token).catch(() => {});
    }

    const allDone = next.completedLessonIds.length >= lessons.length;
    if (allDone && courseFinalTest && !next.finalTestPassed) {
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

      const result = await gradeCourseFinalTest(courseId, payload, token);
      setGradeResult(result);
      setTestSubmitted(true);
      setLastTestScore(result.scorePercent);

      const next = markFinalTestResult(courseId, result.passed, result.scorePercent, progressUserId);
      setProgress(next);
      void refetchFinalTest();

      if (!result.passed) {
        toastError(
          result.locked
            ? 'Тесттен 3 жолу өтпөдүңүз. Даярданып, кайрадан тест тапшырыңыз.'
            : 'Тесттен өтпөдүңүз',
        );
      }
    } catch (error) {
      if (error instanceof TestLockedError) {
        toastError(error.message);
        void refetchFinalTest();
      } else {
        toastError('Тест тапшырылган жок. Кайра аракет кылыңыз.');
      }
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
      const next = ensureCertificateMeta(courseId, certificateNumber, progressUserId);
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

  const testPassed = Boolean(progress.finalTestPassed);
  const passingScoreLabel = Math.max(
    courseFinalTest?.passingScore ?? PASS_THRESHOLD * 100,
    CERTIFICATE_THRESHOLD * 100,
  );

  if (isFree) {
    return (
      <section className="course-learn-page course-learn-page-free">
        <div className="wrap course-learn-inner">
          <div className="course-learn-head">
            <Link to="/courses/free" className="course-learn-back">
              <ArrowLeft className="h-4 w-4" />
              Бекер курстарга кайтуу
            </Link>
            <div>
              <p className="course-learn-label">Бекер курс</p>
              <h1 className="course-learn-title">{course.title}</h1>
              <p className="course-learn-stats">{lessonCount} видео-баян · YouTube'да ачык көрүү</p>
            </div>
          </div>

          <div className="course-learn-grid">
            <aside className="course-learn-sidebar ui-card">
              <h2 className="course-learn-sidebar-title">Видеолор ({lessonCount})</h2>
              <ul className="course-learn-lessons">
                {lessons.map((lesson) => {
                  const active = lesson.id === activeLessonId;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        className={`course-learn-lesson-btn${
                          active ? ' course-learn-lesson-active' : ''
                        }`}
                        onClick={() => setActiveLessonId(lesson.id)}
                      >
                        <span className="course-learn-lesson-icon" aria-hidden>
                          <PlayCircle className="h-4 w-4" />
                        </span>
                        <span className="course-learn-lesson-text">
                          <span className="course-learn-lesson-name">{lesson.title}</span>
                          <span className="course-learn-lesson-meta">{lesson.duration}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Link to="/courses/free" className="course-learn-back-courses">
                Бекер курстарга өтүү
              </Link>
            </aside>

            <article className="course-learn-main ui-card">
              <div className="course-learn-main-head">
                <div className="course-learn-main-heading">
                  <h2 className="course-learn-main-title">{activeLesson.title}</h2>
                  <p className="course-learn-main-author">Сабактын автору Мухаммадалим Халил</p>
                </div>
                <span className="course-learn-main-step">
                  {activeLesson.order} / {lessonCount}
                </span>
              </div>

              <div className="course-learn-video-block">
                {activeLesson.videoId ? (
                  <FreeYoutubeEmbed videoId={activeLesson.videoId} title={activeLesson.title} />
                ) : null}
                <p className="course-learn-video-hint">
                  Видеону бассаңыз сайтта ойнотулат. Толук YouTube'да ачуу үчүн төмөнкү баскычты колдонуңуз.
                </p>
                <button
                  type="button"
                  className="btn-gold course-learn-free-youtube-btn"
                  onClick={() => {
                    if (activeLesson.videoId) openYoutubeLesson(activeLesson.videoId);
                  }}
                >
                  <PlayCircle className="h-5 w-5" aria-hidden />
                  YouTube'да ачуу
                </button>
              </div>
            </article>
          </div>

          {courseId ? (
            <CourseReviewsSection
              courseRef={courseId}
              courseTitle={course.title}
              courseSlug={course.slug}
              compact
            />
          ) : null}
        </div>
      </section>
    );
  }

  const renderFinalTestPanel = (test: CourseTestPayload) => {
    const testLocked = Boolean(gradeResult?.locked || test.locked);
    const lockedUntil = gradeResult?.lockedUntil ?? test.lockedUntil ?? null;
    const remainingAttempts = gradeResult?.remainingAttempts ?? test.remainingAttempts;

    if (testLocked) {
      return (
        <div className="course-learn-test">
          <h3 className="course-learn-test-title">{test.title}</h3>
          <div className="course-learn-test-lock" role="alert">
            <p className="course-learn-test-lock-title">Тест 1 суткага жабылды</p>
            <p className="course-learn-test-fail">
              Тесттен 3 жолу өтпөдүңүз. Даярданып, кайрадан тест тапшырыңыз.
            </p>
            {lockedUntil ? (
              <p className="course-learn-test-lock-until">Кайра аракет: {formatTestLockUntil(lockedUntil)}</p>
            ) : (
              <p className="course-learn-test-lock-until">Кайра аракет 1 суткадан кийин.</p>
            )}
          </div>
        </div>
      );
    }

    return (
    <div className="course-learn-test">
      <h3 className="course-learn-test-title">{test.title}</h3>
      <p className="course-learn-video-hint">
        Бардык сабактар аяктады. {test.questions.length} суроолук финалдык тестти тапшырыңыз — {CERTIFICATE_THRESHOLD * 100}% жана андан жогору болсо PDF сертификат берилет.
        {typeof remainingAttempts === 'number' && !testPassed ? (
          <> · Калып {remainingAttempts} аракет</>
        ) : null}
      </p>
      <div className="course-learn-test-scroll">
        {test.questions.map((question, qIndex) => {
          const questionResult =
            testSubmitted && gradeResult && !gradeResult.passed
              ? gradeResult.details.find((item) => item.questionId === question.id)
              : undefined;
          const isWrong = questionResult?.isCorrect === false;

          return (
            <fieldset
              key={question.id}
              className={`course-learn-test-q${isWrong ? ' course-learn-test-q-wrong' : ''}`}
            >
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
            {isWrong ? (
              <p className="course-learn-test-wrong-hint" role="alert">
                Туура эмес жооп
              </p>
            ) : null}
          </fieldset>
          );
        })}
      </div>

      {testSubmitted && !testPassed && (
        <>
          <p className="course-learn-test-fail">
            {passingScoreLabel}% дан жогору топтоңуз ({lastTestScore ?? gradeResult?.scorePercent ?? 0}%). Кайра аракет кылыңыз.
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
  };

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
                  lessons,
                  lesson.id,
                  progress.completedLessonIds,
                );
                const completed = progress.completedLessonIds.includes(lesson.id);
                const active = lesson.id === activeLessonId;

                return (
                  <li
                    key={lesson.id}
                    className={`course-learn-lesson-block${!unlocked ? ' course-learn-lesson-item-locked' : ''}`}
                  >
                    <div
                      className={`course-learn-lesson-video-row${
                        completed ? ' course-learn-lesson-video-row-done' : ''
                      }`}
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
                          <span className="course-learn-lesson-meta">
                            {lesson.duration}
                            <span
                              className={`course-learn-lesson-watch${
                                completed
                                  ? ' course-learn-lesson-watch-done'
                                  : unlocked
                                    ? ' course-learn-lesson-watch-open'
                                    : ' course-learn-lesson-watch-locked'
                              }`}
                            >
                              {completed ? 'Көрүлүп бүттү' : unlocked ? 'Бүтө элек' : 'Кулуп'}
                            </span>
                          </span>
                        </span>
                      </button>
                      <div
                        className={`course-learn-lesson-mini-video${
                          completed ? ' course-learn-lesson-mini-video-done' : ''
                        }`}
                      >
                        {lesson.videoId ? (
                          <img src={youtubeThumbnail(lesson.videoId)} alt="" />
                        ) : null}
                        <span className="course-learn-lesson-mini-play" aria-hidden>
                          {completed ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : (
                            <PlayCircle className="h-6 w-6" fill="currentColor" />
                          )}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {allLessonsDone && courseFinalTest && !finalTestPassed ? (
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
                ) : (
                  <div className="course-learn-video-block">
                    {isActiveLessonCompleted ? (
                      <div className="course-learn-review-success">
                        <CheckCircle2 className="h-5 w-5" aria-hidden />
                        <span>Сабак аякталды — кайра көрө аласыз</span>
                      </div>
                    ) : null}

                    {activeLesson.videoId ? (
                      <CourseYoutubePlayer
                        key={`${activeLesson.id}-${isActiveLessonCompleted ? 'rewatch' : 'watch'}`}
                        videoId={activeLesson.videoId}
                        title={activeLesson.title}
                        onWatchComplete={handleWatchComplete}
                        requireFullWatch={!isActiveLessonCompleted}
                        allowSpeedControl={isActiveLessonCompleted}
                      />
                    ) : (
                      <div className="course-learn-locked-msg">
                        <Lock className="h-8 w-8" aria-hidden />
                        <p>Сабак шилтемеси ачыла элек. Доступ берилгенде көрө аласыз.</p>
                      </div>
                    )}

                    {isActiveLessonCompleted ? (
                      <>
                        <p className="course-learn-video-hint">
                          Видеону каалаган убакта кайра көрүңүз · ылдамдыкты өзгөртүүгө болот
                        </p>
                        {(() => {
                          const next = lessons.find(
                            (l) =>
                              canAccessLesson(lessons, l.id, progress.completedLessonIds) &&
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
                                {!courseFinalTest ? (
                                  <p className="course-learn-done-text">Курс ийгиликтүү аяктады!</p>
                                ) : !finalTestPassed ? (
                                  <>
                                    <p className="course-learn-done-text">
                                      Сертификат алуу үчүн курстук финалдык тестти {CERTIFICATE_THRESHOLD * 100}% жана андан жогору топтоңуз.
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
                                ) : (
                                  <p className="course-learn-done-text">
                                    Сертификат үчүн курстук тестти {CERTIFICATE_THRESHOLD * 100}% жана андан жогору топтоңуз.
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
                      </>
                    ) : (
                      <>
                        <p className="course-learn-video-hint">Видеону аягына чейин көрүңүз.</p>
                        <button
                          type="button"
                          className="btn-primary course-learn-video-btn"
                          disabled={!videoWatched}
                          onClick={handleVideoComplete}
                        >
                          {!videoWatched ? 'Видеону аягына чейин көрүңүз...' : 'Көрүү аяктады — улантуу'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </article>
        </div>
        {courseId ? (
          <CourseReviewsSection
            courseRef={courseId}
            courseTitle={course?.title}
            courseSlug={course?.slug}
            compact
          />
        ) : null}
      </div>
    </section>
  );
}
