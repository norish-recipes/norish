"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@heroui/react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  PlayIcon,
  PauseIcon,
  PlusIcon,
  MinusIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { useRouter } from "next/navigation";
import useSound from "use-sound";
import { useTranslations } from "next-intl";

import { useTimersEnabledQuery } from "@/hooks/config";
import { useTimerStore } from "@/stores/timers";
import { createClientLogger } from "@/lib/logger";
import { formatTimerMs } from "@/lib/helpers";
import { useAutoHide } from "@/hooks/auto-hide";
import { useNotificationPermission } from "@/hooks/use-notification-permission";

const logger = createClientLogger("timer-dock");

// Global tick loop component - only runs when timers are active
function TimerTicker() {
  const tick = useTimerStore((state) => state.tick);
  const timers = useTimerStore((state) => state.timers);

  // Check if there are any running timers
  const hasRunningTimers = timers.some((t) => t.status === "running");

  useEffect(() => {
    // Only start interval if there are running timers
    if (!hasRunningTimers) {
      return;
    }

    const interval = setInterval(() => {
      tick();
    }, 1000);

    return () => clearInterval(interval);
  }, [tick, hasRunningTimers]);

  return null;
}

export function TimerDock() {
  const { timersEnabled } = useTimersEnabledQuery();
  const timers = useTimerStore((state) => state.timers);
  const clearAll = useTimerStore((state) => state.clearAll);
  const runningTimers = timers.filter((t) => t.status === "running");
  const pausedTimers = timers.filter((t) => t.status === "paused");
  const completedTimers = timers.filter((t) => t.status === "completed");

  const allActiveOrPaused = [...runningTimers, ...pausedTimers, ...completedTimers];
  const t = useTranslations("common");
  const router = useRouter();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Track whether dock has been expanded before — distinguishes a collapse
  // transition (needs crossfade) from a fresh appearance (outer container handles fade)
  const hasExpandedRef = useRef(false);
  const { isDenied: notificationsDenied, isSupported: notificationsSupported } =
    useNotificationPermission();

  // Auto-hide with nav (disabled when expanded to keep it visible)
  const { isVisible } = useAutoHide({ disabled: isExpanded });

  // Hydration fix and mobile detection
  useEffect(() => {
    setIsClient(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Clear all timers when feature is disabled
  useEffect(() => {
    if (timersEnabled === false && timers.length > 0) {
      logger.info("Timers feature disabled, clearing all timers");
      clearAll();
    }
  }, [timersEnabled, timers.length, clearAll]);

  // Audio Logic
  const [play, { stop }] = useSound("/sounds/timer-done.mp3", {
    volume: 1.0,
    loop: true,
    interrupt: false,
  });

  const hasCompletedTimers = completedTimers.length > 0;
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (hasCompletedTimers) {
      if (!isPlaying) {
        play();
        setIsPlaying(true);
      }
    } else {
      if (isPlaying) {
        stop();
        setIsPlaying(false);
      }
    }
  }, [hasCompletedTimers, isPlaying, play, stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const hasTimers = allActiveOrPaused.length > 0;

  // Reset to collapsed when all timers are removed
  useEffect(() => {
    if (!hasTimers) {
      setIsExpanded(false);
      hasExpandedRef.current = false;
    }
  }, [hasTimers]);

  if (!isClient || !timersEnabled) return null;

  // Sort: completed first (to alert), then active by remaining time
  const sortedTimers = [...allActiveOrPaused].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return -1;
    if (b.status === "completed" && a.status !== "completed") return 1;

    return a.remainingMs - b.remainingMs;
  });

  const topTimer = sortedTimers[0];
  const timerCount = allActiveOrPaused.length;

  // Position values matching groceries button pattern (mobile only)
  const bottomWhenNavVisible = "calc(max(env(safe-area-inset-bottom), 1rem) + 4.5rem)";
  const bottomWhenNavHidden = "calc(max(env(safe-area-inset-bottom), 1rem) + 1rem)";
  const desktopBottom = "1rem";

  return (
    <>
      <TimerTicker />
      <AnimatePresence>
        {hasTimers && (
          <motion.div
            animate={
              isMobile
                ? {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    bottom: isVisible ? bottomWhenNavVisible : bottomWhenNavHidden,
                  }
                : { opacity: 1, y: 0, scale: 1 }
            }
            className="fixed right-4 z-50 flex flex-col items-end space-y-2"
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            initial={{ opacity: 0, y: 16 }}
            style={{
              bottom: isMobile ? bottomWhenNavVisible : desktopBottom,
            }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            {/* Morphing Container */}
            <motion.div
              layout
              className={`overflow-hidden shadow-xl ring-1 ring-black/5 backdrop-blur-sm ${
                isExpanded
                  ? "bg-content1 w-80 rounded-2xl dark:ring-white/10"
                  : "bg-content1/90 rounded-full dark:ring-white/10"
              }`}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              {isExpanded ? (
                <motion.div
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Header */}
                  <button
                    aria-label="Close timer summary"
                    className="border-default-100 flex w-full cursor-pointer items-center justify-between border-b p-4"
                    type="button"
                    onClick={() => setIsExpanded(false)}
                  >
                    <h3 className="text-foreground text-sm font-semibold">
                      {timerCount === 1
                        ? t("timer.label_one")
                        : t("timer.label_other", { count: timerCount })}
                    </h3>
                    <ChevronDownIcon className="text-default-500 h-4 w-4" />
                  </button>

                  {/* Timer List */}
                  <div className="max-h-96 overflow-y-auto">
                    {sortedTimers.map((timer, index) => (
                      <TimerRow
                        key={timer.id}
                        isLast={index === sortedTimers.length - 1}
                        router={router}
                        t={t}
                        timer={timer}
                      />
                    ))}
                  </div>

                  {/* Notifications disabled hint */}
                  {notificationsSupported && notificationsDenied && (
                    <div className="border-default-200 text-default-500 border-t px-4 py-2 text-xs">
                      {t("timer.notifications_disabled_hint")}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.button
                  animate={{ opacity: 1 }}
                  className={`group text-foreground flex items-center gap-3 px-4 py-3 transition-all hover:shadow-xl`}
                  initial={hasExpandedRef.current ? { opacity: 0 } : false}
                  transition={
                    hasExpandedRef.current ? { duration: 0.1, delay: 0.12 } : { duration: 0 }
                  }
                  type="button"
                  onClick={() => {
                    hasExpandedRef.current = true;
                    setIsExpanded(true);
                  }}
                >
                  <div className="flex flex-col items-start">
                    <span className="mb-1 max-w-[120px] truncate text-xs leading-none font-medium opacity-75">
                      {timerCount === 1
                        ? topTimer.label
                        : t("timer.label_other", { count: timerCount })}
                    </span>
                    <span
                      className={`font-mono text-lg leading-none font-bold tabular-nums ${
                        topTimer.status === "completed" ? "text-danger" : ""
                      }`}
                    >
                      {formatTimerMs(topTimer.remainingMs)}
                    </span>
                  </div>

                  <ChevronUpIcon className="h-4 w-4 opacity-50 transition-opacity group-hover:opacity-100" />
                </motion.button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Helper for smart increment
function getSmartIncrement(originalDurationMs: number): number {
  const minutes = originalDurationMs / 1000 / 60;

  if (minutes < 5) return 10 * 1000; // 10s
  if (minutes < 20) return 60 * 1000; // 1m

  return 5 * 60 * 1000; // 5m
}

function TimerRow({
  timer,
  t,
  router,
  isLast,
}: {
  timer: import("@/stores/timers").Timer;
  t: (key: string) => string;
  router: ReturnType<typeof useRouter>;
  isLast: boolean;
}) {
  const pauseTimer = useTimerStore((state) => state.pauseTimer);
  const startTimer = useTimerStore((state) => state.startTimer);
  const removeTimer = useTimerStore((state) => state.removeTimer);
  const adjustTimer = useTimerStore((state) => state.adjustTimer);

  const isCompleted = timer.status === "completed";
  const isRunning = timer.status === "running";

  const smartIncrement = getSmartIncrement(timer.originalDurationMs);

  const handleTimerClick = () => {
    router.push(`/recipes/${timer.recipeId}`);
  };

  return (
    <div
      className={`flex items-center gap-4 p-4 ${
        !isLast ? "border-default-100 border-b" : ""
      } hover:bg-default-100/50 transition-colors`}
    >
      {/* Timer Info - Clickable */}
      <button
        aria-label={`Go to recipe for ${timer.label}`}
        className="min-w-0 flex-1 cursor-pointer text-left transition-opacity hover:opacity-80"
        type="button"
        onClick={handleTimerClick}
      >
        <h4
          className={`mb-1 truncate text-sm font-medium ${isCompleted ? "text-danger" : "text-foreground"}`}
        >
          {timer.label}
        </h4>
        {timer.recipeName && (
          <p className="text-default-500 mb-1.5 truncate text-xs">{timer.recipeName}</p>
        )}
        <div
          className={`font-mono text-xl font-semibold ${
            isCompleted ? "text-danger" : "text-foreground"
          }`}
        >
          {formatTimerMs(timer.remainingMs)}
        </div>
      </button>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            isIconOnly
            aria-label={`Decrease time by ${formatTimerMs(smartIncrement)}`}
            size="sm"
            title={`-${formatTimerMs(smartIncrement)}`}
            variant="light"
            onPress={() => adjustTimer(timer.id, -smartIncrement)}
          >
            <MinusIcon className="h-4 w-4" />
          </Button>

          <Button
            isIconOnly
            aria-label={`Increase time by ${formatTimerMs(smartIncrement)}`}
            size="sm"
            title={`+${formatTimerMs(smartIncrement)}`}
            variant="light"
            onPress={() => adjustTimer(timer.id, smartIncrement)}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="bg-default-200 h-8 w-px" />

        {isCompleted ? (
          <Button
            aria-label="Dismiss completed timer"
            color="danger"
            size="sm"
            variant="flat"
            onPress={() => removeTimer(timer.id)}
          >
            {t("timer.done_action")}
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              isIconOnly
              aria-label={isRunning ? "Pause timer" : "Start timer"}
              size="sm"
              variant="light"
              onPress={() => (isRunning ? pauseTimer(timer.id) : startTimer(timer.id))}
            >
              {isRunning ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
            </Button>

            <Button
              isIconOnly
              aria-label="Dismiss timer"
              color="danger"
              size="sm"
              variant="light"
              onPress={() => removeTimer(timer.id)}
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
