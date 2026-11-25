import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Lock,
  PlayCircle,
} from "lucide-react";
import {
  CERTIFICATE_THRESHOLD,
  ensureCertificateMeta,
  isCertificateEligible,
  loadCourseProgress,
  markLessonComplete,
  PASS_THRESHOLD,
  saveCourseProgress,
  type CourseProgress,
} from "../lib/courseAccess";
import { useAuth } from "../context/AuthContext";
import { useCourseEnrollment } from "../hooks/useMyEnrollments";
import {
  completeCourseLesson,
  fetchCourseProgress,
  issueCourseCertificate,
} from "../lib/course-progress-api";
import { ApiError, DEFAULT_RETRY_AFTER_SEC } from "../lib/api-errors";
import {
  confirmedLessonIds,
  isCertificateReadyFromServer,
  isFinalTestAvailable,
  unconfirmedLessonIds,
} from "../lib/server-progress";
import { fetchCourseByRef, isFreeCourse } from "../lib/course-api";
import { CourseYoutubePlayer } from "../components/CourseYoutubeLink";
import {
  isLessonUnlocked,
  mapLessonsToCourseLessons,
  getFirstUnlockedLessonId,
  resolveCompletedLessonIds,
  type CourseLesson,
} from "../data/courseLessons";
import { SITE } from "../data/landing";
import { getLessonsByCourse } from "../lib/lesson-api";
import {
  fetchCourseFinalTest,
  gradeCourseFinalTest,
  TestLockedError,
  type CourseTestPayload,
  type GradeTestResult,
} from "../lib/test-api";
import {
  downloadCourseCertificate,
  generateCertificateNumber,
  loadCertificateName,
  prepareCertificateWindow,
  saveCertificateName,
  SITE_LOGO_URL,
} from "../lib/certificatePdf";
import { showSidebarCertificateButton } from "../lib/certificate-save";
import { youtubeThumbnail, youtubeWatchUrl } from "../lib/youtube";
import { getErrorMessage, toastError, toastSuccess } from "../lib/toast";
import { CourseReviewsSection } from "../components/CourseReviews";

type ViewMode = "lesson" | "final-test";

function formatTestLockUntil(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
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
  window.open(youtubeWatchUrl(videoId), "_blank", "noopener,noreferrer");
}

function FreeYoutubeEmbed({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  const { t } = useTranslation();
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
        aria-label={t("learn.playOnSite", { title })}
      >
        <img
          src={youtubeThumbnail(videoId)}
          alt=""
          className="course-learn-free-preview-img"
        />
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
  const { t } = useTranslation();
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const lessonFromQuery = searchParams.get("lesson");
  const navigate = useNavigate();

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fetchCourseByRef(courseId!),
    enabled: Boolean(courseId),
  });

  const isFree = course ? isFreeCourse(course) : false;

  const { token, user } = useAuth();
  const { enrolled, isLoading: enrollmentLoading } = useCourseEnrollment(
    course
      ? { id: course.id, slug: course.slug, recordId: course.recordId }
      : null,
  );
  const hasAccess = isFree || enrolled;
  const progressUserId = user?.id ?? null;
  const progressAliases = useMemo(
    () =>
      course
        ? [course.id, course.slug, course.recordId].filter(
            (value): value is string => Boolean(value),
          )
        : [],
    [course],
  );
  const {
    data: apiLessons,
    isLoading: lessonsLoading,
    isError: lessonsIsError,
    error: lessonsQueryError,
    refetch: refetchLessons,
  } = useQuery({
    queryKey: [
      "course-lessons",
      courseId,
      hasAccess ? "open" : "locked",
      token ? "auth" : "anon",
    ],
    queryFn: () => getLessonsByCourse(courseId!, token),
    enabled: Boolean(courseId && course && hasAccess),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const lessons = useMemo(
    () =>
      apiLessons && course
        ? mapLessonsToCourseLessons(apiLessons, course.title)
        : [],
    [apiLessons, course?.title],
  );

  const lessonsUnlockRetryRef = useRef(false);
  // If enrollment says open but lessons still came back locked (stale/anon cache), refetch once.
  useEffect(() => {
    if (!hasAccess || !enrolled || !apiLessons?.length || !token) return;
    const allLocked = apiLessons.every(
      (lesson) => lesson.locked || !lesson.youtubeVideoId,
    );
    if (!allLocked) {
      lessonsUnlockRetryRef.current = false;
      return;
    }
    if (lessonsUnlockRetryRef.current) return;
    lessonsUnlockRetryRef.current = true;
    void refetchLessons();
  }, [hasAccess, enrolled, apiLessons, token, refetchLessons]);

  const {
    data: serverProgress,
    isError: progressLoadFailed,
    refetch: refetchProgress,
  } = useQuery({
    queryKey: ["course-progress", courseId, progressUserId],
    queryFn: () => fetchCourseProgress(courseId!, token!),
    enabled: Boolean(
      courseId && token && progressUserId && hasAccess && !isFree,
    ),
    staleTime: 10_000,
  });

  const lessonIdsKey = useMemo(
    () => lessons.map((lesson) => lesson.id).join(","),
    [lessons],
  );

  // Filled by the effect below (paid: from the server, free: from this device). Starting
  // empty avoids reading localStorage here, where the legacy progress key would be removed.
  const [progress, setProgress] = useState<CourseProgress>({
    completedLessonIds: [],
  });
  /** Paid courses: lessons done only on this device, not confirmed by the server (display only). */
  const [unconfirmedIds, setUnconfirmedIds] = useState<string[]>([]);
  const [completePending, setCompletePending] = useState(false);
  /** After a 429 the "watched" button stays disabled until this time; nothing retries by itself. */
  const [completeBlockedUntil, setCompleteBlockedUntil] = useState(0);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [videoWatched, setVideoWatched] = useState(false);
  const [choiceAnswers, setChoiceAnswers] = useState<Record<string, string>>(
    {},
  );
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [testSubmitted, setTestSubmitted] = useState(false);
  const [lastTestScore, setLastTestScore] = useState<number | null>(null);
  const [gradeResult, setGradeResult] = useState<GradeTestResult | null>(null);
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("lesson");
  const [certificateName, setCertificateName] = useState("");
  const [certificateDownloading, setCertificateDownloading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setCertificateName("");
      return;
    }
    const stored = loadCertificateName(user.id);
    if (stored) {
      setCertificateName(stored);
      return;
    }
    const fromProfile = `${user.firstName} ${user.lastName}`.trim();
    setCertificateName(fromProfile);
  }, [user?.id, user?.firstName, user?.lastName]);

  useEffect(() => {
    if (!courseId || courseLoading || enrollmentLoading) return;
    if (!course) {
      navigate("/courses", { replace: true });
      return;
    }
    if (!hasAccess) {
      navigate(`/courses/${courseId}`, { replace: true });
      return;
    }
    if (!isFree) {
      // QA H-2: for a paid course only server-confirmed lessons count. Local progress is read
      // (without dropping the legacy key) only to show what this device has but the server
      // does not; it is never widened, never written back and never sent to the server.
      const local = loadCourseProgress(courseId, progressUserId, {
        aliases: progressAliases,
        adoptLegacy: false,
      });
      const serverIds = serverProgress?.completedLessonIds ?? [];
      setUnconfirmedIds(
        serverProgress
          ? unconfirmedLessonIds(lessons, local.completedLessonIds, serverIds)
          : [],
      );
      setProgress({
        completedLessonIds: serverProgress
          ? confirmedLessonIds(lessons, serverIds)
          : [],
        lessonScores: local.lessonScores,
        finalTestPassed: Boolean(serverProgress?.finalTestPassed),
        finalTestScore:
          typeof serverProgress?.finalTestScore === "number"
            ? serverProgress.finalTestScore
            : undefined,
        certificateNumber: serverProgress?.certificate?.certificateNumber,
        certificateIssuedAt: serverProgress?.certificate?.issuedAt,
      });
      if (
        serverProgress?.certificate?.recipientName &&
        !loadCertificateName(progressUserId)
      ) {
        setCertificateName(serverProgress.certificate.recipientName);
      }
      return;
    }

    const local = loadCourseProgress(courseId, progressUserId, {
      aliases: progressAliases,
      adoptLegacy: false,
    });
    const storedIds = [
      ...local.completedLessonIds,
      ...(serverProgress?.completedLessonIds ?? []),
    ];
    const completedLessonIds = lessons.length
      ? resolveCompletedLessonIds(lessons, storedIds)
      : [...new Set(storedIds)];

    const serverScore =
      typeof serverProgress?.finalTestScore === "number"
        ? serverProgress.finalTestScore
        : 0;
    const localScore =
      typeof local.finalTestScore === "number" ? local.finalTestScore : 0;
    const finalTestScore = Math.max(serverScore, localScore) || undefined;
    const finalTestPassed = Boolean(
      local.finalTestPassed ||
      serverProgress?.finalTestPassed ||
      (finalTestScore != null && finalTestScore >= CERTIFICATE_THRESHOLD * 100),
    );

    const next = {
      ...local,
      completedLessonIds,
      finalTestPassed: finalTestPassed || local.finalTestPassed,
      finalTestScore: finalTestScore ?? local.finalTestScore,
      certificateNumber:
        serverProgress?.certificate?.certificateNumber ??
        local.certificateNumber,
      certificateIssuedAt:
        serverProgress?.certificate?.issuedAt ?? local.certificateIssuedAt,
    };
    saveCourseProgress(courseId, next, progressUserId);
    setProgress(next);

    if (
      serverProgress?.certificate?.recipientName &&
      !loadCertificateName(progressUserId)
    ) {
      setCertificateName(serverProgress.certificate.recipientName);
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
    const firstOpenId =
      getFirstUnlockedLessonId(lessons, completedIds) ?? lessons[0].id;

    if (
      lessonFromQuery &&
      lessons.some((l) => l.id === lessonFromQuery) &&
      canAccessLesson(lessons, lessonFromQuery, completedIds)
    ) {
      setActiveLessonId(lessonFromQuery);
      return;
    }

    if (
      lessonFromQuery &&
      !canAccessLesson(lessons, lessonFromQuery, completedIds)
    ) {
      navigate(`/courses/${courseId}/learn`, { replace: true });
    }

    setActiveLessonId((prev) => {
      if (prev && canAccessLesson(lessons, prev, completedIds)) return prev;
      return firstOpenId;
    });
  }, [
    lessonIdsKey,
    lessons,
    progress.completedLessonIds,
    lessonFromQuery,
    courseId,
    navigate,
    isFree,
  ]);

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
  }, [
    activeLessonId,
    lessonIdsKey,
    lessons,
    progress.completedLessonIds,
    isFree,
  ]);

  const handleWatchComplete = useCallback(() => {
    setVideoWatched(true);
  }, []);

  // Re-enables the "watched" button once the 429 wait is over. It only clears the block —
  // the learner presses the button again; no request is sent from here.
  useEffect(() => {
    if (!completeBlockedUntil) return;
    const wait = completeBlockedUntil - Date.now();
    if (wait <= 0) {
      setCompleteBlockedUntil(0);
      return;
    }
    const timer = window.setTimeout(() => setCompleteBlockedUntil(0), wait);
    return () => window.clearTimeout(timer);
  }, [completeBlockedUntil]);

  // Free course on phones/tablets: the lesson list sits below the video, so after picking a
  // lesson bring its title and video into view (below the sticky header). Desktop shows both
  // columns side by side and is left as is.
  const freeLessonMainRef = useRef<HTMLElement>(null);
  const scrollToFreeLessonRef = useRef(false);
  const scrollToFreeLesson = useCallback(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const main = freeLessonMainRef.current;
    if (!main) return;
    const header = document.querySelector(".header-wave");
    const offset = (header?.getBoundingClientRect().bottom ?? 0) + 12;
    const top = main.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!scrollToFreeLessonRef.current) return;
    scrollToFreeLessonRef.current = false;
    scrollToFreeLesson();
  }, [activeLessonId, scrollToFreeLesson]);

  const selectFreeLesson = (lessonId: string) => {
    if (lessonId === activeLessonId) {
      scrollToFreeLesson();
      return;
    }
    scrollToFreeLessonRef.current = true;
    setActiveLessonId(lessonId);
  };

  const activeLesson = lessons.find((l) => l.id === activeLessonId);
  const completedCount = progress.completedLessonIds.length;
  const isActiveLessonCompleted = activeLesson
    ? progress.completedLessonIds.includes(activeLesson.id)
    : false;
  const activeAccessible = activeLesson
    ? canAccessLesson(lessons, activeLesson.id, progress.completedLessonIds)
    : false;

  const {
    data: courseFinalTest,
    isLoading: courseFinalTestLoading,
    refetch: refetchFinalTest,
  } = useQuery({
    queryKey: ["course-final-test", courseId, progressUserId],
    queryFn: () => fetchCourseFinalTest(courseId!, token),
    // Only once access is known: without it the page redirects to the course page anyway.
    enabled: Boolean(courseId && course && !isFree && hasAccess && !enrollmentLoading),
  });

  const allTestQuestionsAnswered = useMemo(() => {
    if (!courseFinalTest?.questions.length) return false;
    return courseFinalTest.questions.every((question) => {
      if (question.questionType === "choice") {
        return Boolean(choiceAnswers[question.id]);
      }
      return Boolean(textAnswers[question.id]?.trim());
    });
  }, [courseFinalTest, choiceAnswers, textAnswers]);

  /**
   * Paid course (QA H-2): a lesson counts only once the server confirms it. On any failure
   * nothing is marked locally, so the learner can press the button again; a 429 disables the
   * button for Retry-After (or 60 s) and nothing is retried automatically.
   */
  const completePaidLesson = async (lessonId: string) => {
    if (!courseId || !token || !serverProgress || completePending) return;
    if (completeBlockedUntil > Date.now()) return;
    setCompletePending(true);
    try {
      await completeCourseLesson(courseId, lessonId, token);
      const refreshed = await refetchProgress();
      const confirmed = refreshed.data
        ? confirmedLessonIds(lessons, refreshed.data.completedLessonIds)
        : [];
      if (lessons.length > 0 && confirmed.length >= lessons.length) {
        // The exam was loaded while lessons were missing — load it again now.
        const test = await refetchFinalTest();
        if (isFinalTestAvailable(test.data) && !refreshed.data?.finalTestPassed) {
          setViewMode("final-test");
          setChoiceAnswers({});
          setTextAnswers({});
          setGradeResult(null);
          setTestSubmitted(false);
          setLastTestScore(null);
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const seconds = error.retryAfterSec ?? DEFAULT_RETRY_AFTER_SEC;
        setCompleteBlockedUntil(Date.now() + seconds * 1000);
        toastError(t("learn.completeRateLimited", { seconds }));
      } else if (error instanceof ApiError && error.status === 400) {
        // The server has not confirmed the previous lesson: reload its progress and go to the
        // first open lesson it has not confirmed yet (published order; numbers may have gaps).
        // Without such a lesson nothing moves — never fall back to lesson 1.
        toastError(t("learn.previousNotConfirmed"));
        const refreshed = await refetchProgress();
        if (refreshed.isError || !refreshed.data) {
          toastError(t("learn.progressLoadFailed"));
        } else {
          const confirmed = confirmedLessonIds(
            lessons,
            refreshed.data.completedLessonIds,
          );
          const nextToComplete = [...lessons]
            .sort((a, b) => a.order - b.order)
            .find(
              (lesson) =>
                !confirmed.includes(lesson.id) &&
                canAccessLesson(lessons, lesson.id, confirmed),
            );
          if (nextToComplete) {
            setViewMode("lesson");
            setActiveLessonId(nextToComplete.id);
          }
        }
      } else {
        toastError(t("learn.saveFailed"));
      }
    } finally {
      setCompletePending(false);
    }
  };

  const handleVideoComplete = () => {
    if (
      !videoWatched ||
      !activeAccessible ||
      !activeLesson ||
      !courseId ||
      isActiveLessonCompleted
    )
      return;

    if (!isFree) {
      void completePaidLesson(activeLesson.id);
      return;
    }

    const next = markLessonComplete(
      courseId,
      activeLesson.id,
      undefined,
      progressUserId,
    );
    setProgress(next);
    setVideoWatched(true);

    const allDone = next.completedLessonIds.length >= lessons.length;
    if (allDone && courseFinalTest && !next.finalTestPassed) {
      setViewMode("final-test");
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
          question.questionType === "choice"
            ? choiceAnswers[question.id]
            : undefined,
        textAnswer:
          question.questionType === "text"
            ? textAnswers[question.id]?.trim()
            : undefined,
      }));

      const result = await gradeCourseFinalTest(courseId, payload, token);
      setGradeResult(result);
      setTestSubmitted(true);
      setLastTestScore(result.scorePercent);

      // The server keeps the attempt; reload its progress instead of writing a local result.
      const certificatePassed =
        result.passed && result.scorePercent >= CERTIFICATE_THRESHOLD * 100;
      setProgress((prev) => ({
        ...prev,
        finalTestPassed: Boolean(prev.finalTestPassed) || certificatePassed,
        finalTestScore: Math.max(prev.finalTestScore ?? 0, result.scorePercent),
      }));
      void refetchProgress();
      void refetchFinalTest();

      if (!result.passed) {
        toastError(
          result.locked
            ? t("learn.failed3")
            : t("learn.failed"),
        );
      }
    } catch (error) {
      if (error instanceof TestLockedError) {
        toastError(getErrorMessage(error, t("learn.failed3")));
        void refetchFinalTest();
      } else if (
        error instanceof ApiError &&
        error.status === 403 &&
        error.code === "LESSONS_INCOMPLETE"
      ) {
        // QA H-2: the server has not confirmed every lesson — back to the lessons.
        const total =
          typeof error.details.total === "number" ? error.details.total : lessons.length;
        const done =
          typeof error.details.done === "number"
            ? error.details.done
            : progress.completedLessonIds.length;
        toastError(t("learn.lessonsRequiredForTest", { done, total }));
        setViewMode("lesson");
        void refetchProgress();
        void refetchFinalTest();
      } else {
        toastError(t("learn.submitFailed"));
      }
    } finally {
      setTestSubmitting(false);
    }
  };

  const handleCertificateDownload = async () => {
    if (!courseId || !course || certificateDownloading) return;

    const trimmedName = certificateName.trim();
    if (!trimmedName) return;

    saveCertificateName(trimmedName, progressUserId);

    const score = progress.finalTestScore ?? 0;
    // iOS: the tab for the PDF must be opened now, inside the click (see prepareCertificateWindow).
    const targetWindow = prepareCertificateWindow(t("learn.certPreparing"));
    setCertificateDownloading(true);
    try {
      let certificateNumber =
        progress.certificateNumber ?? generateCertificateNumber(courseId);

      if (token && !isFree) {
        const issued = await issueCourseCertificate(courseId, token, {
          studentName: trimmedName,
          certificateNumber,
        });
        certificateNumber = issued.certificateNumber;
        // The server holds the certificate (an already issued one is returned unchanged);
        // keep it in page state and reload the server progress — no local write.
        setProgress((prev) => ({
          ...prev,
          certificateNumber: issued.certificateNumber,
          certificateIssuedAt: issued.issuedAt,
        }));
        void refetchProgress();
      } else if (!progress.certificateNumber) {
        const next = ensureCertificateMeta(
          courseId,
          certificateNumber,
          progressUserId,
        );
        setProgress(next);
      }

      const result = await downloadCourseCertificate(
        {
          studentName: trimmedName,
          courseTitle: course.title,
          scorePercent: score,
          issuedAt: new Date(),
          certificateNumber,
        },
        targetWindow,
      );
      if (result === "ok") toastSuccess(t("learn.certReady"));
      if (result === "opened") toastSuccess(t("learn.certOpenedIos"));
    } catch (err) {
      if (targetWindow && !targetWindow.closed) targetWindow.close();
      toastError(
        getErrorMessage(err, t("learn.certFailed")),
      );
    } finally {
      setCertificateDownloading(false);
    }
  };

  const allLessonsDone = progress.completedLessonIds.length >= lessons.length;
  /** `lessonsComplete: false` closes the exam whatever the questions; older servers: questions only. */
  const examAvailable = isFinalTestAvailable(courseFinalTest);
  /** A certificate the server already issued stays downloadable whatever the current progress. */
  const hasIssuedCertificate = !isFree && Boolean(serverProgress?.certificate);
  const certificateReady = isFree
    ? isCertificateEligible(progress, lessons.length, Boolean(courseFinalTest))
    : isCertificateReadyFromServer({
        hasIssuedCertificate,
        hasFinalTest: Boolean(courseFinalTest),
        allLessonsConfirmed: allLessonsDone,
        finalTestPassed: Boolean(progress.finalTestPassed),
        finalTestScore: progress.finalTestScore,
        passScore: CERTIFICATE_THRESHOLD * 100,
      });
  const finalTestPassed = Boolean(progress.finalTestPassed);
  /** Paid course without loaded server progress: nothing that needs confirmed progress is allowed. */
  const progressUnavailable = !isFree && !serverProgress;

  const lessonCount = lessons.length || course?.lessonCount || 0;

  if (courseLoading || !courseId) {
    return (
      <section className="course-learn-page">
        <div className="wrap course-learn-inner">
          <p className="course-learn-stats">{t("common.loading")}</p>
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
          <p className="course-learn-stats">{t("learn.lessonsLoading")}</p>
        </div>
      </section>
    );
  }

  if (lessonsIsError) {
    const message =
      lessonsQueryError instanceof Error &&
      lessonsQueryError.message === "Курс табылган жок"
        ? t("learn.courseNotInDb")
        : t("learn.lessonsLoadFailed");
    return (
      <section className="course-learn-page">
        <div className="wrap course-learn-inner">
          <Link to={`/courses/${courseId}`} className="course-learn-back">
            <ArrowLeft className="h-4 w-4" />
            {t("learn.backToCourse")}
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
            {t("learn.backToCourse")}
          </Link>
          <p className="course-learn-stats">
            {t("learn.noPublished")}
          </p>
        </div>
      </section>
    );
  }

  if (!activeLesson) {
    return (
      <section className="course-learn-page">
        <div className="wrap course-learn-inner">
          <p className="course-learn-stats">{t("learn.lessonsLoading")}</p>
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
              {t("learn.backToFree")}
            </Link>
            <div>
              <p className="course-learn-label">{t("learn.freeCourse")}</p>
              <h1 className="course-learn-title">{course.title}</h1>
              <p className="course-learn-stats">
                {t("learn.freeStats", { count: lessonCount })}
              </p>
            </div>
          </div>

          <div className="course-learn-grid">
            <aside className="course-learn-sidebar ui-card">
              <h2 className="course-learn-sidebar-title">
                {t("learn.videos", { count: lessonCount })}
              </h2>
              <ul className="course-learn-lessons">
                {lessons.map((lesson) => {
                  const active = lesson.id === activeLessonId;
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        className={`course-learn-lesson-btn${
                          active ? " course-learn-lesson-active" : ""
                        }`}
                        onClick={() => selectFreeLesson(lesson.id)}
                      >
                        <span className="course-learn-lesson-icon" aria-hidden>
                          <PlayCircle className="h-4 w-4" />
                        </span>
                        <span className="course-learn-lesson-text">
                          <span className="course-learn-lesson-name">
                            {lesson.title}
                          </span>
                          <span className="course-learn-lesson-meta">
                            {lesson.duration}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Link to="/courses/free" className="course-learn-back-courses">
                {t("learn.toFree")}
              </Link>
            </aside>

            <article
              ref={freeLessonMainRef}
              className="course-learn-main ui-card"
            >
              <div className="course-learn-main-head">
                <div className="course-learn-main-heading">
                  <h2 className="course-learn-main-title">
                    {activeLesson.title}
                  </h2>
                  <p className="course-learn-main-author">
                    {t("learn.author")}
                  </p>
                </div>
                <span className="course-learn-main-step">
                  {activeLesson.order} / {lessonCount}
                </span>
              </div>

              <div className="course-learn-video-block">
                {activeLesson.videoId ? (
                  <FreeYoutubeEmbed
                    videoId={activeLesson.videoId}
                    title={activeLesson.title}
                  />
                ) : null}
                <p className="course-learn-video-hint">
                  {t("learn.freeHint")}
                </p>
                <button
                  type="button"
                  className="btn-gold course-learn-free-youtube-btn"
                  onClick={() => {
                    if (activeLesson.videoId)
                      openYoutubeLesson(activeLesson.videoId);
                  }}
                >
                  <PlayCircle className="h-5 w-5" aria-hidden />
                  {t("learn.openYoutube")}
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>
    );
  }

  const renderFinalTestPanel = (test: CourseTestPayload) => {
    const testLocked = Boolean(gradeResult?.locked || test.locked);
    const lockedUntil = gradeResult?.lockedUntil ?? test.lockedUntil ?? null;
    const remainingAttempts =
      gradeResult?.remainingAttempts ?? test.remainingAttempts;

    if (testLocked) {
      return (
        <div className="course-learn-test">
          <h3 className="course-learn-test-title">{test.title}</h3>
          <div className="course-learn-test-lock" role="alert">
            <p className="course-learn-test-lock-title">
              {t("learn.testLocked")}
            </p>
            <p className="course-learn-test-fail">
              {t("learn.failed3")}
            </p>
            {lockedUntil ? (
              <p className="course-learn-test-lock-until">
                {t("learn.retryAt", { date: formatTestLockUntil(lockedUntil) })}
              </p>
            ) : (
              <p className="course-learn-test-lock-until">
                {t("learn.retryIn24h")}
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="course-learn-test">
        <h3 className="course-learn-test-title">{test.title}</h3>
        <p className="course-learn-video-hint">
          {t("learn.testIntro", {
            count: test.questions.length,
            pct: CERTIFICATE_THRESHOLD * 100,
          })}
          {typeof remainingAttempts === "number" && !testPassed ? (
            <>{t("learn.attemptsLeft", { count: remainingAttempts })}</>
          ) : null}
        </p>
        <div className="course-learn-test-scroll">
          {test.questions.map((question, qIndex) => {
            // Per-question right/wrong is intentionally not shown: the API only
            // returns the overall score (QA H-1).
            return (
              <fieldset key={question.id} className="course-learn-test-q">
                <legend>
                  {qIndex + 1}. {question.questionText}
                </legend>
                {question.questionType === "choice" && question.options ? (
                  <div className="course-learn-test-options">
                    {question.options.map((option) => (
                      <label
                        key={option.id}
                        className="course-learn-test-option"
                      >
                        <input
                          type="radio"
                          name={`final-q-${question.id}`}
                          checked={choiceAnswers[question.id] === option.id}
                          onChange={() =>
                            setChoiceAnswers((prev) => ({
                              ...prev,
                              [question.id]: option.id,
                            }))
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
                    value={textAnswers[question.id] ?? ""}
                    onChange={(e) =>
                      setTextAnswers((prev) => ({
                        ...prev,
                        [question.id]: e.target.value,
                      }))
                    }
                    placeholder={t("learn.answerPlaceholder")}
                    disabled={testSubmitted && testPassed}
                  />
                )}
              </fieldset>
            );
          })}
        </div>

        {testSubmitted && !testPassed && (
          <>
            <p className="course-learn-test-fail">
              {t("learn.scoreAbove", {
                pct: passingScoreLabel,
                score: lastTestScore ?? gradeResult?.scorePercent ?? 0,
              })}
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
              {t("learn.retake")}
            </button>
          </>
        )}

        {testPassed ? (
          <div className="course-learn-test-pass-wrap">
            <p className="course-learn-test-pass">
              <CheckCircle2 className="h-4 w-4 inline" />{" "}
              {t("learn.testPassed", {
                score: lastTestScore ?? progress.finalTestScore,
              })}
            </p>
            {certificateReady ? (
              <div className="course-learn-done course-learn-done-inline">
                <p className="course-learn-test-cert-hint">
                  {t("learn.canDownloadCert")}
                </p>
                <label className="course-learn-cert-name-field">
                  <span className="course-learn-cert-name-label">{t("learn.yourName")}</span>
                  <input
                    type="text"
                    className="course-learn-cert-name-input"
                    value={certificateName}
                    onChange={(e) => setCertificateName(e.target.value)}
                    placeholder={t("learn.certNamePlaceholder")}
                  />
                </label>
                <button
                  type="button"
                  className="btn-gold course-learn-cert-btn"
                  onClick={() => void handleCertificateDownload()}
                  disabled={!certificateName.trim() || certificateDownloading}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {certificateDownloading
                    ? t("learn.preparing")
                    : t("learn.downloadCert")}
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
            {testSubmitting ? t("learn.checking") : t("learn.submitTest")}
          </button>
        )}
      </div>
    );
  };

  return (
    <section className="course-learn-page">
      <div className="wrap course-learn-inner">
        <div className="course-learn-head">
          <Link
            to={isFree ? "/courses/free" : "/courses"}
            className="course-learn-back"
          >
            <ArrowLeft className="h-4 w-4" />
            {isFree ? t("learn.backToFreeShort") : t("learn.backToCourses")}
          </Link>
          <div>
            <p className="course-learn-label">{t("learn.myCourse")}</p>
            <h1 className="course-learn-title">{course.title}</h1>
            <p className="course-learn-stats">
              {t("learn.stats", {
                count: lessonCount,
                done: completedCount,
                left: lessonCount - completedCount,
              })}
            </p>
          </div>
        </div>

        <div className="course-learn-grid">
          <aside className="course-learn-sidebar ui-card">
            <h2 className="course-learn-sidebar-title">
              {t("learn.videos", { count: lessonCount })}
            </h2>
            <ul className="course-learn-lessons">
              {lessons.map((lesson) => {
                const unlocked = canAccessLesson(
                  lessons,
                  lesson.id,
                  progress.completedLessonIds,
                );
                const completed = progress.completedLessonIds.includes(
                  lesson.id,
                );
                const active = lesson.id === activeLessonId;

                const openLesson = () => {
                  if (!unlocked) return;
                  // Completed lessons are always reopenable. Incomplete ones only if
                  // the current lesson is finished (or this is already the active one).
                  if (
                    !completed &&
                    activeLessonId &&
                    activeLessonId !== lesson.id &&
                    !progress.completedLessonIds.includes(activeLessonId)
                  ) {
                    return;
                  }
                  setViewMode("lesson");
                  setActiveLessonId(lesson.id);
                };

                return (
                  <li
                    key={lesson.id}
                    className={`course-learn-lesson-block${!unlocked ? " course-learn-lesson-item-locked" : ""}`}
                  >
                    <div
                      className={`course-learn-lesson-video-row${
                        completed ? " course-learn-lesson-video-row-done" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={`course-learn-lesson-btn${
                          active ? " course-learn-lesson-active" : ""
                        }${completed ? " course-learn-lesson-done" : ""}${
                          !unlocked ? " course-learn-lesson-locked" : ""
                        }`}
                        disabled={!unlocked}
                        onClick={openLesson}
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
                          <span className="course-learn-lesson-name">
                            {lesson.title}
                          </span>
                          <span className="course-learn-lesson-meta">
                            {lesson.duration}
                            <span
                              className={`course-learn-lesson-watch${
                                completed
                                  ? " course-learn-lesson-watch-done"
                                  : unlocked
                                    ? " course-learn-lesson-watch-open"
                                    : " course-learn-lesson-watch-locked"
                              }`}
                            >
                              {completed
                                ? t("learn.watchedDone")
                                : unconfirmedIds.includes(lesson.id)
                                  ? t("learn.notConfirmed")
                                  : unlocked
                                    ? t("learn.notDone")
                                    : t("learn.locked")}
                            </span>
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`course-learn-lesson-mini-video${
                          completed
                            ? " course-learn-lesson-mini-video-done"
                            : ""
                        }`}
                        disabled={!unlocked}
                        aria-label={t("learn.openVideo", { title: lesson.title })}
                        onClick={openLesson}
                      >
                        {lesson.videoId ? (
                          <img src={youtubeThumbnail(lesson.videoId)} alt="" />
                        ) : null}
                        <span
                          className="course-learn-lesson-mini-play"
                          aria-hidden
                        >
                          {completed ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : (
                            <PlayCircle
                              className="h-6 w-6"
                              fill="currentColor"
                            />
                          )}
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {allLessonsDone && examAvailable && !finalTestPassed ? (
              <div className="course-learn-sidebar-final-test">
                <button
                  type="button"
                  className={`btn-gold course-learn-final-test-nav${
                    viewMode === "final-test"
                      ? " course-learn-final-test-nav-active"
                      : ""
                  }`}
                  onClick={() => {
                    setViewMode("final-test");
                    setChoiceAnswers({});
                    setTextAnswers({});
                    setGradeResult(null);
                    setTestSubmitted(false);
                    setLastTestScore(null);
                  }}
                >
                  {t("learn.finalTest")}
                </button>
              </div>
            ) : null}

            {/* One download button per page: the sidebar only when the main area has none. */}
            {showSidebarCertificateButton({ hasIssuedCertificate, allLessonsDone }) ? (
              <div className="course-learn-sidebar-final-test">
                <label className="course-learn-cert-name-field">
                  <span className="course-learn-cert-name-label">{t("learn.yourName")}</span>
                  <input
                    type="text"
                    className="course-learn-cert-name-input"
                    value={certificateName}
                    onChange={(e) => setCertificateName(e.target.value)}
                    placeholder={t("learn.certNamePlaceholder")}
                  />
                </label>
                <button
                  type="button"
                  className="btn-gold course-learn-final-test-nav"
                  disabled={!certificateName.trim() || certificateDownloading}
                  onClick={() => void handleCertificateDownload()}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {certificateDownloading
                    ? t("learn.preparing")
                    : t("learn.downloadCert")}
                </button>
              </div>
            ) : null}

            <Link
              to={isFree ? "/courses/free" : "/courses"}
              className="course-learn-back-courses"
            >
              {isFree ? t("learn.toFree") : t("learn.toCourses")}
            </Link>
          </aside>

          <article className="course-learn-main ui-card">
            {!isFree && progressLoadFailed ? (
              <div className="course-learn-locked-msg" role="alert">
                <p>{t("learn.progressLoadFailed")}</p>
                <button
                  type="button"
                  className="btn-gold course-learn-next-btn"
                  onClick={() => void refetchProgress()}
                >
                  {t("learn.retry")}
                </button>
              </div>
            ) : null}
            {viewMode === "final-test" && courseFinalTest && examAvailable ? (
              <>
                <div className="course-learn-main-head">
                  <h2 className="course-learn-main-title">
                    {t("learn.finalTest")}
                  </h2>
                  <button
                    type="button"
                    className="course-learn-back-to-lessons"
                    onClick={() => setViewMode("lesson")}
                  >
                    {t("learn.backToLessons")}
                  </button>
                </div>
                {courseFinalTestLoading ? (
                  <p className="course-learn-stats">{t("learn.testLoading")}</p>
                ) : (
                  renderFinalTestPanel(courseFinalTest)
                )}
              </>
            ) : (
              <>
                <div className="course-learn-main-head">
                  <div className="course-learn-main-heading">
                    <h2 className="course-learn-main-title">
                      {activeLesson.title}
                    </h2>
                    <p className="course-learn-main-author">
                      {t("learn.author")}
                    </p>
                  </div>
                  <span className="course-learn-main-step">
                    {activeLesson.order} / {lessonCount}
                  </span>
                </div>

                {!activeAccessible ? (
                  <div className="course-learn-locked-msg">
                    <Lock className="h-8 w-8" aria-hidden />
                    <p>{t("learn.videoLocked")}</p>
                  </div>
                ) : (
                  <div className="course-learn-video-block">
                    {isActiveLessonCompleted ? (
                      <div className="course-learn-review-success">
                        <CheckCircle2 className="h-5 w-5" aria-hidden />
                        <span>{t("learn.lessonDoneRewatch")}</span>
                      </div>
                    ) : null}

                    {activeLesson.videoId ? (
                      <CourseYoutubePlayer
                        key={`${activeLesson.id}-${isActiveLessonCompleted ? "rewatch" : "watch"}`}
                        videoId={activeLesson.videoId}
                        title={activeLesson.title}
                        onWatchComplete={handleWatchComplete}
                        requireFullWatch={!isActiveLessonCompleted}
                        allowSpeedControl={isActiveLessonCompleted}
                      />
                    ) : (
                      <div className="course-learn-locked-msg">
                        <Lock className="h-8 w-8" aria-hidden />
                        <p>
                          {t("learn.linkNotOpen")}
                        </p>
                      </div>
                    )}

                    {isActiveLessonCompleted ? (
                      <>
                        <p className="course-learn-video-hint">
                          {t("learn.rewatchHint")}
                        </p>
                        {(() => {
                          const next = lessons.find(
                            (l) =>
                              canAccessLesson(
                                lessons,
                                l.id,
                                progress.completedLessonIds,
                              ) && !progress.completedLessonIds.includes(l.id),
                          );
                          if (!next) {
                            return (
                              <div className="course-learn-done">
                                <img
                                  src={SITE_LOGO_URL}
                                  alt={SITE.name}
                                  className="course-learn-done-logo"
                                />
                                <p className="course-learn-done-all">
                                  {t("learn.allVideosDone")}
                                </p>
                                {!courseFinalTest ? (
                                  certificateReady ? (
                                    <>
                                      <p className="course-learn-done-title">
                                        {t("learn.certUnlocked")}
                                      </p>
                                      <p className="course-learn-done-text">
                                        {t("learn.allLessonsDoneDownload")}
                                      </p>
                                      <label className="course-learn-cert-name-field">
                                        <span className="course-learn-cert-name-label">
                                          {t("learn.yourName")}
                                        </span>
                                        <input
                                          type="text"
                                          className="course-learn-cert-name-input"
                                          value={certificateName}
                                          onChange={(e) =>
                                            setCertificateName(e.target.value)
                                          }
                                          placeholder={t("learn.certNamePlaceholder")}
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        className="btn-gold course-learn-cert-btn"
                                        onClick={() =>
                                          void handleCertificateDownload()
                                        }
                                        disabled={
                                          !certificateName.trim() ||
                                          certificateDownloading
                                        }
                                      >
                                        <Download
                                          className="h-4 w-4"
                                          aria-hidden
                                        />
                                        {certificateDownloading
                                          ? t("learn.preparing")
                                          : t("learn.downloadCert")}
                                      </button>
                                    </>
                                  ) : (
                                    <p className="course-learn-done-text">
                                      {t("learn.courseDone")}
                                    </p>
                                  )
                                ) : !finalTestPassed && !examAvailable ? (
                                  // The exam is closed (the server reports unfinished
                                  // lessons, or it has no questions): never offer an empty test.
                                  <p className="course-learn-done-text">
                                    {courseFinalTest.lessonsComplete === false
                                      ? t("learn.lessonsRequiredForTest", {
                                          done:
                                            courseFinalTest.lessonsRequired?.done ??
                                            completedCount,
                                          total:
                                            courseFinalTest.lessonsRequired?.total ??
                                            lessons.length,
                                        })
                                      : t("learn.courseDone")}
                                  </p>
                                ) : !finalTestPassed ? (
                                  <>
                                    <p className="course-learn-done-text">
                                      {t("learn.needTestForCert", {
                                        pct: CERTIFICATE_THRESHOLD * 100,
                                      })}
                                    </p>
                                    <button
                                      type="button"
                                      className="btn-gold course-learn-next-btn"
                                      onClick={() => setViewMode("final-test")}
                                    >
                                      {t("learn.toTest")}
                                    </button>
                                  </>
                                ) : certificateReady ? (
                                  <>
                                    <p className="course-learn-done-title">
                                      {t("learn.certUnlocked")}
                                    </p>
                                    <p className="course-learn-done-text">
                                      {t("learn.testScore", {
                                        score: progress.finalTestScore ?? 0,
                                        pct: CERTIFICATE_THRESHOLD * 100,
                                      })}
                                    </p>
                                    <label className="course-learn-cert-name-field">
                                      <span className="course-learn-cert-name-label">
                                        {t("learn.yourName")}
                                      </span>
                                      <input
                                        type="text"
                                        className="course-learn-cert-name-input"
                                        value={certificateName}
                                        onChange={(e) =>
                                          setCertificateName(e.target.value)
                                        }
                                        placeholder={t("learn.certNamePlaceholder")}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      className="btn-gold course-learn-cert-btn"
                                      onClick={() =>
                                        void handleCertificateDownload()
                                      }
                                      disabled={
                                        !certificateName.trim() ||
                                        certificateDownloading
                                      }
                                    >
                                      <Download
                                        className="h-4 w-4"
                                        aria-hidden
                                      />
                                      {certificateDownloading
                                        ? t("learn.preparing")
                                        : t("learn.downloadCert")}
                                    </button>
                                  </>
                                ) : (
                                  <p className="course-learn-done-text">
                                    {t("learn.certNeedsTest", {
                                      pct: CERTIFICATE_THRESHOLD * 100,
                                    })}
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
                              {t("learn.nextVideo", { n: next.order })}
                            </button>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        <p className="course-learn-video-hint">
                          {t("learn.watchToEnd")}
                        </p>
                        <button
                          type="button"
                          className="btn-primary course-learn-video-btn"
                          disabled={
                            !videoWatched ||
                            (!isFree &&
                              (progressUnavailable ||
                                completePending ||
                                completeBlockedUntil > 0))
                          }
                          onClick={handleVideoComplete}
                        >
                          {!videoWatched
                            ? t("learn.watchToEndBtn")
                            : completePending
                              ? t("learn.preparing")
                              : t("learn.watchedContinue")}
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
