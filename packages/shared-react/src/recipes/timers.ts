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
  id: string; // Composite ID: recipeId-stepIndex-occurrenceIndex
  recipeId: string;
  recipeName?: string; // Recipe name for display when multiple recipes
  label: string; // "Top with cilantro..." truncated
  originalDurationMs: number;
  remainingMs: number;
  status: TimerStatus;
  lastTickAt: number | null; // Timestamp of last update to calculate drift
};

interface TimerState {
  timers: Timer[];

  // Actions
  addTimer: (
    id: string,
    recipeId: string,
    label: string,
    durationMs: number,
    recipeName?: string
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

      addTimer: (id, recipeId, label, durationMs, recipeName) => {
        const existing = get().timers.find((t) => t.id === id);

        if (existing) return; // Don't duplicate

        set((state) => ({
          timers: [
            ...state.timers,
            {
              id,
              recipeId,
              recipeName,
              label,
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
          const newTimers = state.timers.map((t) => {
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

            return { ...t, remainingMs: newRemaining, lastTickAt: now } as Timer;
          });

          return (hasChanges ? { timers: newTimers } : {}) as Partial<TimerState>;
        });

        return finished;
      },
    }),
    {
      name: "norish-timers",
      storage: createJSONStorage(() => timerStorage),
      // Nothing is read or written until the app connects its storage.
      skipHydration: true,
    }
  )
);

/** Persists Recipe Timers through the app's storage and restores the ones it holds; call once. */
export function connectTimerStorage(storage: PlatformStorage): void {
  if (platformStorage === storage) return;

  platformStorage = storage;
  void useTimerStore.persist.rehydrate();
}

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
