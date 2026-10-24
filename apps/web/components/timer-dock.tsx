"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTimersEnabledQuery } from "@/hooks/config";
import { useDockedTimers } from "@/hooks/use-docked-timers";
import { useFloatingDock } from "@/hooks/use-floating-dock";
import { useNotificationPermission } from "@/hooks/use-notification-permission";
import { useTimerStore } from "@/stores/timers";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import useSound from "use-sound";

import { addBasePath } from "@norish/shared/lib/base-path";
import { formatTimerMs } from "@norish/shared/lib/helpers";
import { createClientLogger } from "@norish/shared/lib/logger";
import { cssFloatingDockPill } from "@norish/web/config/css-tokens";

const logger = createClientLogger("timer-dock");

// Global tick loop component - only runs when timers are active
export function TimerTicker() {
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
export function TimerDock({
  className = "",
  isExpanded: expandedProp,
  onExpandedChange,
}: {
  className?: string;
  /** Controlled where something else owns the dock, e.g. cooking mode's bottom bar. */
  isExpanded?: boolean;
  onExpandedChange?: (isExpanded: boolean) => void;
}) {
  const { timersEnabled } = useTimersEnabledQuery();
  const timers = useTimerStore((state) => state.timers);
  const clearAll = useTimerStore((state) => state.clearAll);
  // What the dock shows, and — read by anything else that floats above the
  // nav — whether the dock is in its corner at all.
  const dockedTimers = useDockedTimers();
  const completedTimers = dockedTimers.filter((timer) => timer.status === "completed");
  const t = useTranslations("common");
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(false);
  const isExpanded = expandedProp ?? uncontrolledExpanded;
  const setIsExpanded = (next: boolean) => {
    if (onExpandedChange) {
      onExpandedChange(next);

      return;
    }

    setUncontrolledExpanded(next);
  };
  // Track whether dock has been expanded before — distinguishes a collapse
  // transition (needs crossfade) from a fresh appearance (outer container handles fade)
  const [hasExpanded, setHasExpanded] = useState(false);
  const { isDenied: notificationsDenied, isSupported: notificationsSupported } =
    useNotificationPermission();

  // Keeps station above the nav pill and shrinks with it; held at full size
  // while expanded, because a summary the cook opened must not shrink away.
  const floatingDock = useFloatingDock({
    align: "end",
    disabled: isExpanded,
  });

  // Clear all timers when feature is disabled
  useEffect(() => {
    if (timersEnabled === false && timers.length > 0) {
      logger.info("Timers feature disabled, clearing all timers");
      clearAll();
    }
  }, [timersEnabled, timers.length, clearAll]);

  // Audio Logic
  const [play, { stop }] = useSound(addBasePath("/sounds/timer-done.mp3"), {
    volume: 1.0,
    loop: true,
    interrupt: false,
  });
  const hasCompletedTimers = completedTimers.length > 0;
  const isPlayingRef = useRef(false);
  useEffect(() => {
    if (hasCompletedTimers) {
      if (!isPlayingRef.current) {
        play();
        isPlayingRef.current = true;
      }
    } else {
      if (isPlayingRef.current) {
        stop();
        isPlayingRef.current = false;
      }
    }
  }, [hasCompletedTimers, play, stop]);
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);
  const hasTimers = dockedTimers.length > 0;

  // Reset to collapsed when all timers are removed
  if (!hasTimers && (uncontrolledExpanded || hasExpanded)) {
    setUncontrolledExpanded(false);
    setHasExpanded(false);
  }
  useEffect(() => {
    if (!hasTimers) {
      onExpandedChange?.(false);
    }
  }, [hasTimers, onExpandedChange]);
  if (!timersEnabled) return null;

  // Sort: completed first (to alert), then active by remaining time
  const sortedTimers = [...dockedTimers].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return -1;
    if (b.status === "completed" && a.status !== "completed") return 1;
    return a.remainingMs - b.remainingMs;
  });
  const topTimer = sortedTimers[0];
  const timerCount = dockedTimers.length;

  return (
    <>
      <TimerTicker />
      <AnimatePresence>
        {topTimer && (
          <motion.div
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              ...floatingDock.animate,
            }}
            className={`${floatingDock.className} ${className || "z-50"}`}
            exit={{
              opacity: 0,
              y: 8,
              scale: 0.94,
            }}
            initial={{
              opacity: 0,
              y: 16,
            }}
            style={floatingDock.style}
            transition={floatingDock.transition}
          >
            {/* Morphing Container */}
            <motion.div
              layout
              className={`border-border bg-surface overflow-hidden border shadow-xl ${floatingDock.pillClassName} ${isExpanded ? "w-80 rounded-2xl" : "rounded-full"}`}
              transition={{
                duration: 0.25,
                ease: [0.4, 0, 0.2, 1],
              }}
            >
              {isExpanded ? (
                <motion.div
                  animate={{
                    opacity: 1,
                  }}
                  exit={{
                    opacity: 0,
                  }}
                  initial={{
                    opacity: 0,
                  }}
                  transition={{
                    duration: 0.15,
                  }}
                >
                  {/* Header */}
                  <button
                    aria-label="Close timer summary"
                    className="border-border flex w-full cursor-pointer items-center justify-between border-b p-4"
                    type="button"
                    onClick={() => setIsExpanded(false)}
                  >
                    <h3 className="text-foreground text-sm font-semibold">
                      {timerCount === 1
                        ? t("timer.label_one")
                        : t("timer.label_other", {
                            count: timerCount,
                          })}
                    </h3>
                    <ChevronDownIcon className="text-muted h-4 w-4" />
                  </button>

                  {/* Timer List */}
                  <div className="max-h-96 overflow-y-auto">
                    {sortedTimers.map((timer, index) => (
                      <TimerRow
                        key={timer.id}
                        isLast={index === sortedTimers.length - 1}
                        t={t}
                        timer={timer}
                      />
                    ))}
                  </div>

                  {/* Notifications disabled hint */}
                  {notificationsSupported && notificationsDenied && (
                    <div className="border-border text-muted border-t px-4 py-2 text-xs">
                      {t("timer.notifications_disabled_hint")}
                    </div>
                  )}
                </motion.div>
              ) : (
                // One row at the cook pill's own height: the two float at
                // opposite ends of the same nav pill, so a taller dock reads
                // as a mismatched pair rather than as a pair.
                <motion.button
                  animate={{
                    opacity: 1,
                  }}
                  className={`group text-foreground flex items-center gap-2 transition-all hover:shadow-xl ${cssFloatingDockPill}`}
                  initial={
                    hasExpanded
                      ? {
                          opacity: 0,
                        }
                      : false
                  }
                  transition={
                    hasExpanded
                      ? {
                          duration: 0.1,
                          delay: 0.12,
                        }
                      : {
                          duration: 0,
                        }
                  }
                  type="button"
                  onClick={() => {
                    setHasExpanded(true);
                    setIsExpanded(true);
                  }}
                >
                  <span className="max-w-[7rem] truncate text-xs font-medium opacity-75">
                    {timerCount === 1
                      ? topTimer.label
                      : t("timer.label_other", {
                          count: timerCount,
                        })}
                  </span>

                  <span
                    className={`font-mono text-sm font-bold tabular-nums ${topTimer.status === "completed" ? "text-danger" : ""}`}
                  >
                    {formatTimerMs(topTimer.remainingMs)}
                  </span>

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
  isLast,
}: {
  timer: import("@/stores/timers").Timer;
  t: (key: string) => string;
  isLast: boolean;
}) {
  const router = useRouter();
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
      className={`flex items-center gap-4 p-4 ${!isLast ? "border-border border-b" : ""} hover:bg-surface-secondary/50 transition-colors`}
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
          <p className="text-muted mb-1.5 truncate text-xs">{timer.recipeName}</p>
        )}
        <div
          className={`font-mono text-xl font-semibold ${isCompleted ? "text-danger" : "text-foreground"}`}
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
            onPress={() => adjustTimer(timer.id, -smartIncrement)}
            variant="tertiary"
          >
            <MinusIcon className="h-4 w-4" />
          </Button>

          <Button
            isIconOnly
            aria-label={`Increase time by ${formatTimerMs(smartIncrement)}`}
            size="sm"
            onPress={() => adjustTimer(timer.id, smartIncrement)}
            variant="tertiary"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>

        <div className="bg-surface-tertiary h-8 w-px" />

        {isCompleted ? (
          <Button
            aria-label="Dismiss completed timer"
            size="sm"
            onPress={() => removeTimer(timer.id)}
            variant="danger-soft"
            className="min-w-16"
          >
            {t("timer.done_action")}
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              isIconOnly
              aria-label={isRunning ? "Pause timer" : "Start timer"}
              size="sm"
              onPress={() => (isRunning ? pauseTimer(timer.id) : startTimer(timer.id))}
              variant="tertiary"
            >
              {isRunning ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
            </Button>

            <Button
              isIconOnly
              aria-label="Dismiss timer"
              size="sm"
              onPress={() => removeTimer(timer.id)}
              variant="danger-soft"
            >
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
