import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Maximize2, Minimize2, Play } from 'lucide-react';

type CourseYoutubePlayerProps = {
  videoId: string;
  title: string;
  onWatchComplete?: () => void;
  requireFullWatch?: boolean;
  allowSpeedControl?: boolean;
};

type YtPlayer = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVideoData?: () => { video_id?: string };
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  loadVideoById: (options: string | { videoId: string; startSeconds?: number }) => void;
  setPlaybackRate?: (rate: number) => void;
  getPlaybackRate?: () => number;
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
const PAUSED = 2;
const SEEK_JUMP_SECONDS = 4;
const PROGRESS_TICK_MS = 1000;
const PLAYBACK_RATES = [1, 1.25, 1.5, 1.75, 2] as const;

function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PROTECTED_PLAYER_VARS = {
  rel: 0,
  modestbranding: 1,
  playsinline: 1,
  fs: 0,
  controls: 0,
  disablekb: 1,
  enablejsapi: 1,
  iv_load_policy: 3,
};

export function CourseYoutubePlayer({
  videoId,
  title,
  onWatchComplete,
  requireFullWatch = true,
  allowSpeedControl = !requireFullWatch,
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
  const [endedCover, setEndedCover] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playbackRateRef = useRef(1);
  const isSeekingRef = useRef(false);
  const videoIdRef = useRef(videoId);
  const embedRef = useRef<HTMLDivElement | null>(null);

  const applyPlaybackRate = useCallback(
    (player?: YtPlayer | null) => {
      const target = player ?? playerRef.current;
      if (!target?.setPlaybackRate || !allowSpeedControl) return;
      try {
        target.setPlaybackRate(playbackRateRef.current);
      } catch {
        /* player not ready */
      }
    },
    [allowSpeedControl],
  );

  const handleSpeedChange = (rate: number) => {
    playbackRateRef.current = rate;
    setPlaybackRateState(rate);
    applyPlaybackRate();
  };

  const handleSeek = useCallback(
    (seconds: number) => {
      const player = playerRef.current;
      if (!player || !allowSpeedControl) return;
      const dur = player.getDuration() || duration;
      if (!dur || dur <= 0) return;
      const clamped = Math.max(0, Math.min(seconds, dur));
      player.seekTo(clamped, true);
      lastKnownTimeRef.current = clamped;
      setCurrentTime(clamped);
      applyPlaybackRate(player);
    },
    [allowSpeedControl, duration, applyPlaybackRate],
  );

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    applyPlaybackRate();
  }, [playbackRate, allowSpeedControl, isPlaying, applyPlaybackRate]);

  useEffect(() => {
    onWatchCompleteRef.current = onWatchComplete;
  }, [onWatchComplete]);

  useEffect(() => {
    const onFsChange = () => {
      const node = embedRef.current;
      const active =
        document.fullscreenElement === node ||
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement === node;
      setIsFullscreen(Boolean(active));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const node = embedRef.current;
    if (!node) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const active = document.fullscreenElement || doc.webkitFullscreenElement;
    if (active) {
      void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      return;
    }
    const request =
      node.requestFullscreen?.bind(node) ??
      (node as HTMLDivElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.bind(node);
    void request?.();
  };

  useEffect(() => {
    completedRef.current = !requireFullWatch;
    watchedSecondsRef.current = 0;
    lastKnownTimeRef.current = 0;
    lastPlayingAtRef.current = null;
    videoIdRef.current = videoId;
    setWatchProgress(requireFullWatch ? 0 : 100);
    setWatchComplete(!requireFullWatch);
    setSeekNotice(false);
    setEndedCover(false);
    setIsPlaying(false);
    setPlaybackRateState(1);
    playbackRateRef.current = 1;
    setCurrentTime(0);
    setDuration(0);
    isSeekingRef.current = false;

    if (!requireFullWatch) {
      onWatchCompleteRef.current?.();
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

    const keepAssignedVideo = (player: YtPlayer) => {
      const playingId = player.getVideoData?.()?.video_id;
      if (!playingId || playingId === videoIdRef.current) return true;
      player.loadVideoById({
        videoId: videoIdRef.current,
        startSeconds: Math.max(0, lastKnownTimeRef.current),
      });
      showSeekNotice();
      return false;
    };

    const trackPlaybackTime = (player: YtPlayer) => {
      const current = player.getCurrentTime();
      if (player.getPlayerState() === PLAYING && current >= lastKnownTimeRef.current) {
        lastKnownTimeRef.current = current;
      }
    };

    const updateProgress = () => {
      const player = playerRef.current;
      if (!player) return;

      if (!keepAssignedVideo(player)) return;

      if (!requireFullWatch) {
        trackPlaybackTime(player);
        const dur = player.getDuration();
        const cur = player.getCurrentTime();
        if (dur > 0) setDuration(dur);
        if (!isSeekingRef.current && dur > 0) setCurrentTime(cur);
        return;
      }

      if (completedRef.current) return;

      const duration = player.getDuration();
      const current = player.getCurrentTime();
      const state = player.getPlayerState();
      if (!duration || duration <= 0) return;

      const forwardJump = current - lastKnownTimeRef.current;
      if (forwardJump > SEEK_JUMP_SECONDS && lastKnownTimeRef.current > 0 && state !== ENDED) {
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
          ...PROTECTED_PLAYER_VARS,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            const iframe = document.querySelector<HTMLIFrameElement>(`#${playerHostId} iframe`);
            if (iframe) iframe.style.pointerEvents = 'none';
            if (allowSpeedControl && event.target.setPlaybackRate) {
              applyPlaybackRate(event.target);
            }
            progressTimer = window.setInterval(updateProgress, PROGRESS_TICK_MS);
          },
          onStateChange: (event) => {
            const player = event.target;
            playerRef.current = player;

            if (event.data === PLAYING) setIsPlaying(true);
            if (event.data === PAUSED || event.data === ENDED) setIsPlaying(false);

            keepAssignedVideo(player);

            if (!requireFullWatch) {
              if (event.data === PLAYING) {
                applyPlaybackRate(player);
              }
              if (event.data === ENDED) {
                player.seekTo(0, true);
                player.pauseVideo();
                lastKnownTimeRef.current = 0;
              }
              return;
            }

            if (event.data === ENDED) {
              const duration = player.getDuration();
              const watchedEnough =
                completedRef.current ||
                (duration > 0 && watchedSecondsRef.current / duration >= WATCH_THRESHOLD);
              if (watchedEnough) {
                markComplete();
                setEndedCover(true);
              } else {
                setEndedCover(false);
                player.seekTo(0, true);
                lastKnownTimeRef.current = 0;
                showSeekNotice();
              }
              return;
            }

            if (event.data === PLAYING) {
              setEndedCover(false);
            }

            if (completedRef.current) return;
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
  }, [videoId, requireFullWatch, allowSpeedControl, applyPlaybackRate]);

  return (
    <div className="course-learn-youtube-wrap">
      <div
        ref={embedRef}
        className="course-learn-embed"
        onContextMenu={(event) => event.preventDefault()}
      >
        <div id={playerHostId} className="course-learn-youtube-host" title={title} />
        <div className="course-learn-yt-chrome-block" aria-hidden />
        <div className="course-learn-yt-chrome-block-bottom" aria-hidden />
        <div className="course-learn-yt-chrome-block-side course-learn-yt-chrome-block-side-left" aria-hidden />
        <div className="course-learn-yt-chrome-block-side course-learn-yt-chrome-block-side-right" aria-hidden />
        {!endedCover ? (
          <button
            type="button"
            className="course-learn-yt-shield"
            aria-label={isPlaying ? 'Пауза' : 'Ойнотуу'}
            onClick={() => {
              const player = playerRef.current;
              if (!player) return;
              if (player.getPlayerState() === PLAYING) player.pauseVideo();
              else {
                applyPlaybackRate(player);
                player.playVideo();
              }
            }}
          >
            {!isPlaying ? (
              <span className="course-learn-yt-play" aria-hidden>
                <Play className="h-10 w-10" fill="currentColor" />
              </span>
            ) : null}
          </button>
        ) : null}
        <button
          type="button"
          className="course-learn-yt-fs"
          aria-label={isFullscreen ? 'Толук экрандан чыгуу' : 'Толук экран'}
          onClick={(event) => {
            event.stopPropagation();
            toggleFullscreen();
          }}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
        {seekNotice ? (
          <p className="course-learn-video-notice">
            {requireFullWatch
              ? 'Бул сабакта башка видеого өтүүгө жана алдыга секирүүгө болбойт'
              : 'Башка видеого же YouTube каналына өтүүгө болбойт'}
          </p>
        ) : null}
        {requireFullWatch && endedCover ? (
          <div className="course-learn-yt-end-cover">
            <p>Сабак аякталды</p>
            <span>Төмөнкү «Улантуу» баскычын басыңыз</span>
          </div>
        ) : null}
      </div>
      {allowSpeedControl ? (
        <div className="course-learn-playback-controls-embed">
          <div
            className="course-learn-playback-speed course-learn-playback-speed-embed"
            role="group"
            aria-label="Видео ылдамдыгы"
          >
            <label className="course-learn-playback-speed-label" htmlFor="course-playback-rate">
              Ылдамдык
            </label>
            <select
              id="course-playback-rate"
              className="course-learn-playback-speed-select"
              value={playbackRate}
              aria-label="Видео ылдамдыгы"
              onChange={(event) => {
                handleSpeedChange(Number(event.target.value));
              }}
            >
              {PLAYBACK_RATES.map((rate) => (
                <option key={rate} value={rate}>
                  {rate === 1 ? '1×' : `${rate}×`}
                </option>
              ))}
            </select>
            <div className="course-learn-playback-speed-btns">
              {PLAYBACK_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className={`course-learn-playback-speed-btn${
                    playbackRate === rate ? ' course-learn-playback-speed-btn-active' : ''
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSpeedChange(rate);
                  }}
                >
                  {rate === 1 ? '1×' : `${rate}×`}
                </button>
              ))}
            </div>
          </div>
          <div className="course-learn-playback-seek-row">
            <span className="course-learn-playback-time">{formatVideoTime(currentTime)}</span>
            <input
              type="range"
              className="course-learn-playback-seek"
              min={0}
              max={Math.max(duration, 1)}
              step={1}
              value={Math.min(currentTime, Math.max(duration, 1))}
              aria-label="Видео убакыты"
              onPointerDown={(event) => {
                event.stopPropagation();
                isSeekingRef.current = true;
              }}
              onChange={(event) => {
                event.stopPropagation();
                const next = Number(event.target.value);
                setCurrentTime(next);
                handleSeek(next);
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                isSeekingRef.current = false;
              }}
              onPointerCancel={() => {
                isSeekingRef.current = false;
              }}
            />
            <span className="course-learn-playback-time">{formatVideoTime(duration)}</span>
          </div>
        </div>
      ) : null}
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
