import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createClientLogger } from "@/lib/logger";

const logger = createClientLogger("timers");

/**
 * Show an OS notification via the service worker when a timer completes
 * while the app is in the background (document.hidden === true).
 */
function showTimerNotification(timer: { label: string; recipeName?: string }) {
  try {
    if (
      typeof document === "undefined" ||
      !document.hidden ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => {
        const title = timer.recipeName ? `${timer.label} — ${timer.recipeName}` : timer.label;

        registration.showNotification(title, {
          body: "Timer complete!",
          icon: "/android-chrome-192x192.png",
          tag: "timer-complete",
          renotify: true,
          requireInteraction: true,
          vibrate: [200, 100, 200],
        } as NotificationOptions);
      })
      .catch((err) => {
        logger.warn(err, "Failed to show timer notification");
      });
  } catch {
    // Graceful fallback — audio still works in foreground
  }
}

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

  // The tick loop to update times
  tick: () => void;
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
              showTimerNotification(t);

              return { ...t, remainingMs: 0, status: "completed", lastTickAt: now };
            }

            hasChanges = true;

            return { ...t, remainingMs: newRemaining, lastTickAt: now } as Timer;
          });

          return (hasChanges ? { timers: newTimers } : {}) as Partial<TimerState>;
        });
      },
    }),
    {
      name: "norish-timers", // localStorage key
    }
  )
);
