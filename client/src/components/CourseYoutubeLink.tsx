import { useEffect, useId, useRef, useState } from 'react';

type CourseYoutubePlayerProps = {
  videoId: string;
  title: string;
  onWatchComplete?: () => void;
  requireFullWatch?: boolean;
};

type YtPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          width?: string | number;
          height?: string | number;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YtPlayer }) => void;
            onStateChange?: (event: { data: number; target: YtPlayer }) => void;
          };
        },
      ) => YtPlayer;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | null = null;

function loadYoutubeApi() {
  if (window.YT?.Player) return Promise.resolve();

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise<void>((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };

      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }

  return youtubeApiPromise;
}

const WATCH_THRESHOLD = 0.95;
const ENDED = 0;
const PLAYING = 1;
const SEEK_JUMP_SECONDS = 4;
const PROGRESS_TICK_MS = 1000;

export function CourseYoutubePlayer({
  videoId,
  title,
  onWatchComplete,
  requireFullWatch = true,
}: CourseYoutubePlayerProps) {
  const reactId = useId().replace(/:/g, '');
  const playerHostId = `yt-player-${reactId}`;
  const playerRef = useRef<YtPlayer | null>(null);
  const completedRef = useRef(false);
  const onWatchCompleteRef = useRef(onWatchComplete);
  const watchedSecondsRef = useRef(0);
  const lastKnownTimeRef = useRef(0);
  const lastPlayingAtRef = useRef<number | null>(null);
  const [watchProgress, setWatchProgress] = useState(0);
  const [watchComplete, setWatchComplete] = useState(false);
  const [seekNotice, setSeekNotice] = useState(false);

  useEffect(() => {
    onWatchCompleteRef.current = onWatchComplete;
  }, [onWatchComplete]);

  useEffect(() => {
    completedRef.current = false;
    watchedSecondsRef.current = 0;
    lastKnownTimeRef.current = 0;
    lastPlayingAtRef.current = null;
    setWatchProgress(0);
    setWatchComplete(false);
    setSeekNotice(false);

    if (!requireFullWatch) {
      completedRef.current = true;
      setWatchProgress(100);
      setWatchComplete(true);
      onWatchCompleteRef.current?.();
      return;
    }

    let progressTimer: number | undefined;
    let seekNoticeTimer: number | undefined;
    let cancelled = false;

    const markComplete = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      setWatchProgress(100);
      setWatchComplete(true);
      onWatchCompleteRef.current?.();
    };

    const resetWatch = (player: YtPlayer) => {
      watchedSecondsRef.current = 0;
      lastKnownTimeRef.current = 0;
      lastPlayingAtRef.current = null;
      setWatchProgress(0);
      player.seekTo(0, true);
    };

    const showSeekNotice = () => {
      setSeekNotice(true);
      if (seekNoticeTimer) window.clearTimeout(seekNoticeTimer);
      seekNoticeTimer = window.setTimeout(() => setSeekNotice(false), 3000);
    };

    const updateProgress = () => {
      const player = playerRef.current;
      if (!player || completedRef.current) return;

      const duration = player.getDuration();
      const current = player.getCurrentTime();
      const state = player.getPlayerState();
      if (!duration || duration <= 0) return;

      const forwardJump = current - lastKnownTimeRef.current;
      if (
        forwardJump > SEEK_JUMP_SECONDS &&
        lastKnownTimeRef.current > 0 &&
        state === PLAYING
      ) {
        resetWatch(player);
        showSeekNotice();
        return;
      }

      if (state === PLAYING) {
        const now = Date.now();
        if (lastPlayingAtRef.current != null) {
          watchedSecondsRef.current += (now - lastPlayingAtRef.current) / 1000;
        }
        lastPlayingAtRef.current = now;
        if (current >= lastKnownTimeRef.current) {
          lastKnownTimeRef.current = current;
        }
      } else {
        lastPlayingAtRef.current = null;
      }

      const percent = Math.min(100, Math.round((watchedSecondsRef.current / duration) * 100));
      setWatchProgress((prev) => (prev === percent ? prev : percent));

      if (watchedSecondsRef.current / duration >= WATCH_THRESHOLD) {
        markComplete();
      }
    };

    void loadYoutubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;

      playerRef.current?.destroy();
      playerRef.current = new window.YT.Player(playerHostId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            progressTimer = window.setInterval(updateProgress, PROGRESS_TICK_MS);
          },
          onStateChange: (event) => {
            const player = event.target;
            playerRef.current = player;

            if (completedRef.current) return;

            if (event.data === ENDED) {
              const duration = player.getDuration();
              if (duration > 0 && watchedSecondsRef.current / duration >= WATCH_THRESHOLD) {
                markComplete();
              } else {
                player.seekTo(0, true);
                lastKnownTimeRef.current = 0;
                showSeekNotice();
              }
              return;
            }

            updateProgress();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (progressTimer) window.clearInterval(progressTimer);
      if (seekNoticeTimer) window.clearTimeout(seekNoticeTimer);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, requireFullWatch]);

  return (
    <div className="course-learn-youtube-wrap">
      <div className="course-learn-embed">
        <div id={playerHostId} className="course-learn-youtube-host" title={title} />
        {requireFullWatch && seekNotice ? (
          <p className="course-learn-video-notice">
            Алдыга секирүүгө болбойт — видеону башынан көрүңүз
          </p>
        ) : null}
      </div>
      {requireFullWatch && !watchComplete ? (
        <p className="course-learn-video-progress" aria-live="polite">
          Көрүлдү: {watchProgress}% · Токтотуп коё аласыз, бирок аягына чейин көрүшүңүз керек
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated CourseYoutubePlayer колдонуңуз */
export const CourseYoutubeLink = CourseYoutubePlayer;
