"use client";

import type { StateStorage } from "zustand/middleware";
import { useEffect } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { PlatformStorage } from "../platform";

const logger = createClientLogger("timers");

let platformStorage: PlatformStorage | null = null;

// Read on every call, so the store can exist before the app hands over its storage.
const timerStorage: StateStorage = {
  getItem: (name) => platformStorage?.getItem(name) ?? null,
  setItem: (name, value) => platformStorage?.setItem(name, value),
  removeItem: (name) => platformStorage?.removeItem(name),
};

export type TimerStatus = "running" | "paused" | "completed";

export type Timer = {
  id: string; // recipeTimerId's, or an older one no step builds now
  recipeId: string;
  recipeName?: string; // Recipe name for display when multiple recipes
  /** The cook mode step it was started from, so a notification can open there. */
  stepIndex?: number;
  label: string; // "Top with cilantro..." truncated
  originalDurationMs: number;
  remainingMs: number;
  status: TimerStatus;
  lastTickAt: number | null; // Timestamp of last update to calculate drift
};

/** A step's timer: its recipe, the step counted from 0 without headings, the duration's place in it. */
export const recipeTimerId = (recipeId: string, stepIndex: number, occurrence: number) =>
  `${recipeId}-s${stepIndex}-${occurrence}`;

interface TimerState {
  timers: Timer[];

  // Actions
  addTimer: (
    timer: Pick<Timer, "id" | "recipeId" | "label" | "recipeName" | "stepIndex"> & {
      durationMs: number;
    }
  ) => void;
  removeTimer: (id: string) => void;
  clearAll: () => void;
  startTimer: (id: string) => void;
  pauseTimer: (id: string) => void;
  resetTimer: (id: string) => void;
  adjustTimer: (id: string, deltaMs: number) => void;

  /** Brings running timers to the clock; returns the ones that reached zero on this tick. */
  tick: () => Timer[];
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: [],

      addTimer: ({ durationMs, ...timer }) => {
        if (get().timers.some((t) => t.id === timer.id)) return; // Don't duplicate

        set((state) => ({
          timers: [
            ...state.timers,
            {
              ...timer,
              originalDurationMs: durationMs,
              remainingMs: durationMs,
              status: "paused",
              lastTickAt: null,
            },
          ],
        }));
      },

      removeTimer: (id) => {
        set((state) => ({
          timers: state.timers.filter((t) => t.id !== id),
        }));
      },

      clearAll: () => {
        set({ timers: [] });
      },

      startTimer: (id) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id ? { ...t, status: "running", lastTickAt: Date.now() } : t
          ),
        }));
      },

      pauseTimer: (id) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id ? { ...t, status: "paused", lastTickAt: null } : t
          ),
        }));
      },

      resetTimer: (id) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: "paused",
                  remainingMs: t.originalDurationMs,
                  lastTickAt: null,
                }
              : t
          ),
        }));
      },

      adjustTimer: (id, deltaMs) => {
        set((state) => ({
          timers: state.timers.map((t) => {
            if (t.id !== id) return t;

            const newRemaining = Math.max(0, t.remainingMs + deltaMs);
            let newStatus = t.status;
            let newLastTickAt = t.lastTickAt;

            if (newRemaining === 0) {
              newStatus = "completed";
              newLastTickAt = Date.now();
            } else if (t.status === "completed") {
              // If adding time to a completed timer, restart it automatically
              newStatus = "running";
              newLastTickAt = Date.now();
            }

            return {
              ...t,
              remainingMs: newRemaining,
              status: newStatus,
              lastTickAt: newLastTickAt,
            };
          }),
        }));
      },

      tick: () => {
        const now = Date.now();
        const finished: Timer[] = [];

        set((state) => {
          let hasChanges = false;
          const newTimers = state.timers.map((t): Timer => {
            if (t.status !== "running") return t;

            if (t.lastTickAt === null) {
              logger.warn(
                `Timer ${t.id} is running but has null lastTickAt. Resetting to current time.`
              );
              hasChanges = true;

              return { ...t, lastTickAt: now };
            }

            const delta = now - t.lastTickAt;
            const newRemaining = Math.max(0, t.remainingMs - delta);

            if (newRemaining === 0 && t.remainingMs > 0) {
              hasChanges = true;
              finished.push(t);

              return { ...t, remainingMs: 0, status: "completed", lastTickAt: now };
            }

            hasChanges = true;

            return { ...t, remainingMs: newRemaining, lastTickAt: now };
          });

          return hasChanges ? { timers: newTimers } : {};
        });

        return finished;
      },
    }),
    {
      name: "norish-timers",
      storage: createJSONStorage(() => timerStorage),
      // Nothing is read or written until the app connects its storage.
      skipHydration: true,
      // A timer started before that joins the stored ones instead of being replaced by them.
      merge: (stored, current) => {
        const timers = (stored as Partial<TimerState> | undefined)?.timers ?? [];
        const ids = new Set(timers.map((timer) => timer.id));

        return { ...current, timers: [...timers, ...current.timers.filter((t) => !ids.has(t.id))] };
      },
    }
  )
);

/** How much one tap of − or + adjusts a timer by: finer for short timers. */
export function timerAdjustStep(originalDurationMs: number): number {
  const minutes = originalDurationMs / 1000 / 60;

  if (minutes < 5) return 10 * 1000;
  if (minutes < 20) return 60 * 1000;

  return 5 * 60 * 1000;
}

/** When a running timer reaches zero by the wall clock; null while it is paused or done. */
export function timerEndsAt(timer: Timer): number | null {
  return timer.status === "running" && timer.lastTickAt !== null
    ? timer.lastTickAt + timer.remainingMs
    : null;
}

const STATUS_RANK: Record<TimerStatus, number> = { completed: 0, running: 1, paused: 2 };

/** Done timers first, to be dealt with, then the soonest running, then the soonest paused. */
export function sortTimers(timers: readonly Timer[]): Timer[] {
  return [...timers].sort((a, b) => {
    if (a.status !== b.status) return STATUS_RANK[a.status] - STATUS_RANK[b.status];

    // A running timer's wall-clock end beats its remaining time, which is stale between ticks.
    const aEnds = timerEndsAt(a);
    const bEnds = timerEndsAt(b);

    return aEnds !== null && bEnds !== null ? aEnds - bEnds : a.remainingMs - b.remainingMs;
  });
}

/** What one glance at the timers shows: the soonest not yet done (maybe paused), and whether any is done. */
export function timerGlance(timers: readonly Timer[]) {
  const sorted = sortTimers(timers);

  return {
    any: sorted.length > 0,
    soonest: sorted.find((timer) => timer.status !== "completed"),
    anyDone: sorted.some((timer) => timer.status === "completed"),
  };
}

/** The timers still counting down at `now`, with their ends, in store order. */
export function runningTimers(
  timers: readonly Timer[],
  now: number
): { timer: Timer; endsAt: number }[] {
  return timers.flatMap((timer) => {
    const endsAt = timerEndsAt(timer);

    return endsAt !== null && endsAt > now ? [{ timer, endsAt }] : [];
  });
}

/** Persists Recipe Timers through the app's storage and restores the ones it holds; call once. */
export function connectTimerStorage(storage: PlatformStorage): void {
  if (platformStorage === storage) return;

  platformStorage = storage;
  void useTimerStore.persist.rehydrate();
}

/** Ticks running timers once a second and hands each one that finishes to `onFinished`, to notify. */
export function useTimerTicker(onFinished: (timer: Timer) => void) {
  const tick = useTimerStore((state) => state.tick);
  const hasRunningTimers = useTimerStore((state) =>
    state.timers.some((timer) => timer.status === "running")
  );

  useEffect(() => {
    if (!hasRunningTimers) return;

    const interval = setInterval(() => tick().forEach((timer) => onFinished(timer)), 1000);

    return () => clearInterval(interval);
  }, [tick, hasRunningTimers, onFinished]);
}
