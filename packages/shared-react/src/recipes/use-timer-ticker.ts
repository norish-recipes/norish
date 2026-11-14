"use client";

import { useEffect } from "react";

import type { Timer } from "./timer-store";
import { useTimerStore } from "./timer-store";

/** What an app does when a Recipe Timer it watched reaches zero, such as notifying. */
export type TimerNotifier = {
  finished: (timer: Timer) => void;
};

/** Ticks running timers once a second and hands each one that finishes to the notifier. */
export function useTimerTicker(notifier: TimerNotifier) {
  const tick = useTimerStore((state) => state.tick);
  const hasRunningTimers = useTimerStore((state) =>
    state.timers.some((timer) => timer.status === "running")
  );

  useEffect(() => {
    if (!hasRunningTimers) return;

    const interval = setInterval(() => tick().forEach((timer) => notifier.finished(timer)), 1000);

    return () => clearInterval(interval);
  }, [tick, hasRunningTimers, notifier]);
}
