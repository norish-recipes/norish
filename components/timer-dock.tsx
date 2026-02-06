"use client";

import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTimerStore } from "@/stores/timers";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
  PlusIcon,
  MinusIcon,
} from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import useSound from "use-sound";
import { useTimersEnabledQuery } from "@/hooks/config";
import { useTranslations } from "next-intl";
import { createClientLogger } from "@/lib/logger";
import { useAutoHide } from "@/hooks/auto-hide";

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

function formatTime(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TimerDock() {
  const { timersEnabled } = useTimersEnabledQuery();
  const timers = useTimerStore((state) => state.timers);
  const clearAll = useTimerStore((state) => state.clearAll);
  const activeTimers = timers.filter((t) => t.status !== "paused" && t.status !== "completed");
  const pausedTimers = timers.filter((t) => t.status === "paused");
  const completedTimers = timers.filter((t) => t.status === "completed");

  const allActiveOrPaused = [...activeTimers, ...pausedTimers, ...completedTimers];
  const t = useTranslations("common");
  const router = useRouter();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  if (!isClient || !timersEnabled) return null;
  if (allActiveOrPaused.length === 0) return <TimerTicker />;

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
      <motion.div
        animate={
          isMobile
            ? {
                bottom: isVisible ? bottomWhenNavVisible : bottomWhenNavHidden,
              }
            : {}
        }
        className="fixed right-4 z-50 flex flex-col items-end space-y-2"
        initial={false}
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
              ? "w-80 rounded-xl bg-white dark:bg-zinc-800 dark:ring-white/10"
              : topTimer.status === "completed"
                ? "rounded-full bg-red-600 ring-0"
                : "rounded-full bg-white/90 dark:bg-zinc-800/90 dark:ring-white/10"
          }`}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          {isExpanded ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Header */}
              <button
                type="button"
                className="flex w-full items-center justify-between border-b border-zinc-200/50 bg-zinc-50/80 p-4 transition-all hover:bg-zinc-100/80 dark:border-zinc-700/50 dark:bg-zinc-700/50 dark:hover:bg-zinc-600/50"
                onClick={() => setIsExpanded(false)}
                aria-label="Close timer summary"
              >
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {timerCount === 1 ? "1 Timer" : `${timerCount} Timers`}
                </h3>
                <ChevronDownIcon className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
              </button>

              {/* Timer List */}
              <div className="max-h-96 overflow-y-auto">
                {sortedTimers.map((timer, index) => (
                  <TimerRow
                    key={timer.id}
                    timer={timer}
                    t={t}
                    router={router}
                    isLast={index === sortedTimers.length - 1}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, delay: 0.2 }}
              type="button"
              onClick={() => setIsExpanded(true)}
              className={`group flex items-center gap-3 px-4 py-3 transition-all hover:shadow-xl ${
                topTimer.status === "completed" ? "text-white" : "text-zinc-900 dark:text-white"
              }`}
            >
              <div className="flex flex-col items-start">
                <span className="mb-1 max-w-[120px] truncate text-xs leading-none font-medium opacity-75">
                  {timerCount === 1 ? topTimer.label : `${timerCount} timers`}
                </span>
                <span className="font-mono text-lg leading-none font-bold tabular-nums">
                  {formatTime(topTimer.remainingMs)}
                </span>
              </div>

              <ChevronUpIcon className="h-4 w-4 opacity-50 transition-opacity group-hover:opacity-100" />
            </motion.button>
          )}
        </motion.div>
      </motion.div>
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
        !isLast ? "border-b border-zinc-200/50 dark:border-zinc-700/50" : ""
      } ${isCompleted ? "bg-red-50/50 dark:bg-red-900/10" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"} transition-colors`}
    >
      {/* Timer Info - Clickable */}
      <button
        type="button"
        className="min-w-0 flex-1 text-left transition-opacity hover:opacity-70"
        onClick={handleTimerClick}
        aria-label={`Go to recipe for ${timer.label}`}
      >
        <h4 className="mb-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {timer.label}
        </h4>
        {timer.recipeName && (
          <p className="mb-1.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
            {timer.recipeName}
          </p>
        )}
        <div
          className={`font-mono text-xl font-semibold ${
            isCompleted ? "text-red-600 dark:text-red-500" : "text-zinc-900 dark:text-zinc-100"
          }`}
        >
          {formatTime(timer.remainingMs)}
        </div>
      </button>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustTimer(timer.id, -smartIncrement)}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
            title={`-${formatTime(smartIncrement)}`}
          >
            <MinusIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => adjustTimer(timer.id, smartIncrement)}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white"
            title={`+${formatTime(smartIncrement)}`}
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-700" />

        {isCompleted ? (
          <button
            type="button"
            onClick={() => removeTimer(timer.id)}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow"
          >
            {t("timer.done_action")}
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => (isRunning ? pauseTimer(timer.id) : startTimer(timer.id))}
              className="rounded-lg p-2 text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {isRunning ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
            </button>

            <button
              type="button"
              onClick={() => removeTimer(timer.id)}
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-700"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
