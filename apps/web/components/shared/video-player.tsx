"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import VideoPlayerSkeleton from "@/components/skeleton/video-player-skeleton";
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  PlayIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import {
  hasDocumentFullscreenApi,
  hasNativeVideoFullscreen,
  isFullscreenControlSupported,
} from "@norish/shared/lib/video-fullscreen";
import { cssMediaControl } from "@norish/web/config/css-tokens";

export interface VideoPlayerProps {
  src: string;
  duration?: number | null;
  poster?: string;
  className?: string;
  onControlsVisibilityChange?: (visible: boolean) => void;
  /**
   * Hands the surrounding page a way into this video's fullscreen, or `null`
   * where the browser offers none. The player draws its own expand control at
   * its bottom edge, which is exactly the band the mobile recipe hero covers
   * with its fade and title (#563) — so the page needs to be able to put the
   * control somewhere the hero cannot swallow.
   */
  onFullscreenAvailabilityChange?: (enterFullscreen: (() => void) | null) => void;
}
export default function VideoPlayer({
  src,
  duration,
  poster,
  className = "",
  onControlsVisibilityChange,
  onFullscreenAvailabilityChange,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchControlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFullscreenRef = useRef(false);
  const mutedBeforeFullscreenRef = useRef(true);
  /**
   * Autoplay is only allowed silently, so the intersection observer mutes the
   * video every time it comes back into view. Once the reader has said what
   * they want the sound to do, that default stops applying — otherwise
   * scrolling the video away and back silently undoes their choice.
   */
  const soundChosenRef = useRef(false);
  const t = useTranslations("recipes.carousel.videoPlayer");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);

  // Check if fullscreen is supported
  useEffect(() => {
    if (typeof document === "undefined") {
      setFullscreenSupported(false);

      return;
    }
    setFullscreenSupported(isFullscreenControlSupported(document, videoRef.current));
  }, []);

  // Handle fullscreen change events (user exits via native controls or Escape)
  useEffect(() => {
    const video = videoRef.current;
    const handleFullscreenChange = () => {
      const fullscreenElement =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement;

      // `fullscreenchange` is a document event, so every player on the page
      // hears it. A recipe page renders its phone and desktop layouts both,
      // one of them hidden — read as "someone is fullscreen", the hidden
      // player would unmute and play along with the one being watched.
      setIsFullscreen(!!fullscreenElement && fullscreenElement === containerRef.current);
    };
    const handleVideoFullscreenStart = () => {
      setIsFullscreen(true);
    };
    const handleVideoFullscreenEnd = () => {
      setIsFullscreen(false);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    video?.addEventListener("webkitbeginfullscreen", handleVideoFullscreenStart as EventListener);
    video?.addEventListener("webkitendfullscreen", handleVideoFullscreenEnd as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      video?.removeEventListener(
        "webkitbeginfullscreen",
        handleVideoFullscreenStart as EventListener
      );
      video?.removeEventListener("webkitendfullscreen", handleVideoFullscreenEnd as EventListener);
    };
  }, []);
  /**
   * Stable so the page can hold on to it as the one way into this video's
   * fullscreen, rather than re-subscribing on every playback tick.
   */
  const enterFullscreen = useCallback(async () => {
    const container = containerRef.current;

    if (!container) return;
    try {
      if (hasDocumentFullscreenApi(document)) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          await (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          await (container as any).msRequestFullscreen();
        }

        return;
      }

      // The iPhone has no element fullscreen at all; the video element's own
      // native player is the only fullscreen there is.
      const video = videoRef.current as
        | (HTMLVideoElement & {
            webkitEnterFullscreen?: () => Promise<void> | void;
          })
        | null;

      if (hasNativeVideoFullscreen(videoRef.current)) {
        video?.webkitEnterFullscreen?.();
      }
    } catch (_err) {
      // Fullscreen request failed, ignore
    }
  }, []);
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (_err) {
      // Exiting fullscreen failed, ignore
    }
  }, []);
  const toggleFullscreen = useCallback(
    (e: React.MouseEvent | React.TouchEvent | any) => {
      e?.stopPropagation?.();

      return isFullscreen ? exitFullscreen() : enterFullscreen();
    },
    [enterFullscreen, exitFullscreen, isFullscreen]
  );

  useEffect(() => {
    if (!onFullscreenAvailabilityChange) return;

    onFullscreenAvailabilityChange(fullscreenSupported ? enterFullscreen : null);

    return () => {
      onFullscreenAvailabilityChange(null);
    };
  }, [enterFullscreen, fullscreenSupported, onFullscreenAvailabilityChange]);

  /**
   * Expanding the video is a request to watch it, so it gains its sound and
   * keeps playing; leaving hands the page back the silent poster it had. The
   * element never changes, so the playback position simply survives both ways.
   */
  useEffect(() => {
    isFullscreenRef.current = isFullscreen;

    const video = videoRef.current;

    if (!video) return;
    if (isFullscreen) {
      mutedBeforeFullscreenRef.current = video.muted;
      video.muted = false;
      setIsMuted(false);
      setIsPlaying(true);
      video.play().catch(() => {
        setIsPlaying(false);
      });

      return;
    }
    video.muted = mutedBeforeFullscreenRef.current;
    setIsMuted(mutedBeforeFullscreenRef.current);
  }, [isFullscreen]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Autoplay observer
  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // A fullscreen video is off the page's own layout; scrolling under
          // it must not pause what the reader is watching.
          if (isFullscreenRef.current) return;

          if (entry.isIntersecting) {
            if (!soundChosenRef.current) {
              video.muted = true;
              setIsMuted(true);
            }
            video.play().catch(() => {
              // Autoplay might fail, that's okay
              setIsPlaying(false);
            });
            setIsPlaying(true);
          } else {
            video.pause();
            setIsPlaying(false);
          }
        });
      },
      {
        threshold: 0.6,
      } // Start playing when 60% visible
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, [src]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration || duration || 0;

      setCurrentTime(current);
      if (total > 0) {
        setProgress((current / total) * 100);
      }
    }
  };
  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };
  const toggleMute = (e: any) => {
    // HeroUI Button onPress/onClick handling
    if (e?.stopPropagation) e.stopPropagation();
    if (videoRef.current) {
      soundChosenRef.current = true;
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };
  const handleLoadedData = () => {
    setIsLoading(false);
  };
  const clearTouchControlsHideTimer = useCallback(() => {
    if (touchControlsHideTimerRef.current) {
      clearTimeout(touchControlsHideTimerRef.current);
      touchControlsHideTimerRef.current = null;
    }
  }, []);
  const handleTouchStart = () => {
    clearTouchControlsHideTimer();
    setShowControls(true);
    // Hide controls after 2.5 seconds of no interaction
    touchControlsHideTimerRef.current = setTimeout(() => {
      setShowControls(false);
      touchControlsHideTimerRef.current = null;
    }, 2500);
  };

  // Tap to play/pause
  const handleTap = (_e: React.MouseEvent | React.TouchEvent) => {
    togglePlay();
  };
  const areControlsVisible = showControls || !isPlaying;

  /**
   * A hero crops to its own shape on purpose, but fullscreen is the one place
   * the whole frame is meant to be visible — so there the player drops the
   * shape it was fitted into and letterboxes instead of cropping (#563).
   */
  const containerClassName = [
    "group relative overflow-hidden bg-black",
    isFullscreen ? "" : "aspect-[9/16] sm:aspect-video",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    onControlsVisibilityChange?.(areControlsVisible);
  }, [areControlsVisible, onControlsVisibilityChange]);
  useEffect(() => {
    return () => {
      clearTouchControlsHideTimer();
    };
  }, [clearTouchControlsHideTimer]);

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      role="button"
      tabIndex={0}
      onClick={handleTap}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          togglePlay();
        }
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onTouchStart={handleTouchStart}
    >
      <video
        ref={videoRef}
        loop
        playsInline
        className={`h-full w-full ${isFullscreen ? "object-contain" : "object-cover"}`}
        muted={isMuted}
        poster={poster}
        src={src}
        onLoadedData={handleLoadedData}
        onPlaying={() => setIsLoading(false)}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsLoading(true)}
      >
        <track
          default={false}
          kind="captions"
          label="English"
          src="data:text/vtt;base64,V0VCVlRVCg=="
        />
      </video>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0">
          <VideoPlayerSkeleton className="h-full rounded-none" />
        </div>
      )}

      {/* Controls Overlay */}
      <AnimatePresence>
        {areControlsVisible && (
          <motion.div
            animate={{
              opacity: 1,
            }}
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60"
            exit={{
              opacity: 0,
            }}
            initial={{
              opacity: 0,
            }}
          >
            {/* Center: Play/Pause Big Icon */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {!isPlaying && (
                <motion.div
                  animate={{
                    scale: 1,
                    opacity: 1,
                  }}
                  className="rounded-full bg-neutral-900 p-4"
                  exit={{
                    scale: 0.5,
                    opacity: 0,
                  }}
                  initial={{
                    scale: 0.5,
                    opacity: 0,
                  }}
                >
                  <PlayIcon className="h-8 w-8 text-white" />
                </motion.div>
              )}
            </div>

            {/* Bottom: Mute, ProgressBar & Time */}
            <div className="pointer-events-auto absolute right-0 bottom-0 left-0 space-y-2 p-4">
              <div className="flex items-center justify-between px-1 text-xs font-medium text-white/90">
                <div className="flex items-center gap-2">
                  <Button
                    isIconOnly
                    aria-label={isMuted ? t("unmute") : t("mute")}
                    className={`rounded-full ${cssMediaControl}`}
                    size="sm"
                    variant="tertiary"
                    onPress={toggleMute}
                  >
                    {isMuted ? (
                      <SpeakerXMarkIcon className="h-5 w-5" />
                    ) : (
                      <SpeakerWaveIcon className="h-5 w-5" />
                    )}
                  </Button>
                  <span>{formatTime(currentTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{formatTime(duration || videoRef.current?.duration || 0)}</span>
                  {fullscreenSupported && (
                    <Button
                      isIconOnly
                      aria-label={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
                      className={`rounded-full ${cssMediaControl}`}
                      size="sm"
                      variant="tertiary"
                      onPress={toggleFullscreen}
                    >
                      {isFullscreen ? (
                        <ArrowsPointingInIcon className="h-5 w-5" />
                      ) : (
                        <ArrowsPointingOutIcon className="h-5 w-5" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* ProgressBar Bar */}
              <div
                aria-label="Video ProgressBar"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={progress}
                className="relative h-1 w-full cursor-pointer overflow-hidden rounded-full bg-neutral-700 transition-colors hover:bg-neutral-600"
                role="slider"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!videoRef.current) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percent = x / rect.width;
                  const newTime = percent * (duration || videoRef.current.duration || 0);

                  videoRef.current.currentTime = newTime;
                }}
                onKeyDown={(e) => {
                  if (!videoRef.current) return;
                  const total = videoRef.current.duration || duration || 0;
                  const current = videoRef.current.currentTime;
                  let newTime = current;

                  if (e.key === "ArrowRight") {
                    newTime = Math.min(total, current + 5);
                  } else if (e.key === "ArrowLeft") {
                    newTime = Math.max(0, current - 5);
                  } else {
                    return;
                  }
                  e.preventDefault();
                  videoRef.current.currentTime = newTime;
                }}
              >
                <motion.div
                  className="absolute top-0 left-0 h-full rounded-full bg-white"
                  layoutId="progress"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
