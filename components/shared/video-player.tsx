"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@heroui/react";
import {
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PlayIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from "@heroicons/react/16/solid";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import VideoPlayerSkeleton from "@/components/skeleton/video-player-skeleton";
import {
  hasDocumentFullscreenApi,
  hasNativeVideoFullscreen,
  isFullscreenControlSupported,
} from "@/lib/video-fullscreen";

export interface VideoPlayerProps {
  src: string;
  duration?: number | null;
  poster?: string;
  className?: string;
}

export default function VideoPlayer({ src, duration, poster, className = "" }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      setIsFullscreen(isCurrentlyFullscreen);
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

  const toggleFullscreen = useCallback(
    async (e: React.MouseEvent | React.TouchEvent | any) => {
      e?.stopPropagation?.();
      const container = containerRef.current;

      if (!container) return;

      try {
        const hasDocumentApi = hasDocumentFullscreenApi(document);

        if (!isFullscreen && hasDocumentApi) {
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

        if (isFullscreen && hasDocumentApi) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          } else if ((document as any).mozCancelFullScreen) {
            await (document as any).mozCancelFullScreen();
          } else if ((document as any).msExitFullscreen) {
            await (document as any).msExitFullscreen();
          }

          return;
        }

        const video = videoRef.current as
          | (HTMLVideoElement & {
              webkitEnterFullscreen?: () => Promise<void> | void;
            })
          | null;

        if (!isFullscreen && hasNativeVideoFullscreen(videoRef.current)) {
          video?.webkitEnterFullscreen?.();
        }
      } catch (_err) {
        // Fullscreen request failed, ignore
      }
    },
    [isFullscreen]
  );

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
          if (entry.isIntersecting) {
            video.muted = true;
            setIsMuted(true);
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
      { threshold: 0.6 } // Start playing when 60% visible
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
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleLoadedData = () => {
    setIsLoading(false);
  };

  const handleTouchStart = () => {
    setShowControls(true);
    // Hide controls after 2.5 seconds of no interaction
    const timer = setTimeout(() => setShowControls(false), 2500);

    return () => clearTimeout(timer);
  };

  // Tap to play/pause
  const handleTap = (_e: React.MouseEvent | React.TouchEvent) => {
    togglePlay();
  };

  return (
    <div
      ref={containerRef}
      className={`group relative aspect-[9/16] overflow-hidden bg-black sm:aspect-video ${className}`}
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
        className="h-full w-full object-cover"
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
        {(showControls || !isPlaying) && (
          <motion.div
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            {/* Center: Play/Pause Big Icon */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {!isPlaying && (
                <motion.div
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-full bg-black/40 p-4 backdrop-blur-sm"
                  exit={{ scale: 0.5, opacity: 0 }}
                  initial={{ scale: 0.5, opacity: 0 }}
                >
                  <PlayIcon className="h-8 w-8 text-white" />
                </motion.div>
              )}
            </div>

            {/* Bottom: Mute, Progress & Time */}
            <div className="pointer-events-auto absolute right-0 bottom-0 left-0 space-y-2 p-4">
              <div className="flex items-center justify-between px-1 pr-16 text-xs font-medium text-white/90 sm:pr-1">
                <div className="flex items-center gap-2">
                  <Button
                    isIconOnly
                    aria-label={isMuted ? t("unmute") : t("mute")}
                    className="rounded-full text-white/90 backdrop-blur-md hover:bg-white/20 hover:text-white"
                    size="sm"
                    variant="light"
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
                      className="rounded-full text-white/90 backdrop-blur-md hover:bg-white/20 hover:text-white"
                      size="sm"
                      variant="light"
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

              {/* Progress Bar */}
              <div
                aria-label="Video Progress"
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={progress}
                className="group/progress relative h-1 w-full cursor-pointer overflow-hidden rounded-full bg-white/30"
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
                  style={{ width: `${progress}%` }}
                />
                <div className="absolute inset-0 bg-white/0 transition-colors group-hover/progress:bg-white/10" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
