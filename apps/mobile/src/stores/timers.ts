import { storage } from "@/lib/storage/mmkv";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { Timer, TimerStatus } from "./timer-types";
import { endLiveActivity, startOrUpdateLiveActivity } from "./timer-live-activity";
import { dismissAllTimerNotifications, showTimerNotification } from "./timer-notifications";

export { requestNotificationPermissions } from "./timer-notifications";
export type { Timer, TimerStatus } from "./timer-types";

const logger = createClientLogger("timers");

// ─── Store ───────────────────────────────────────────────────────────────────

interface TimerState {
  timers: Timer[];

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
  tick: () => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      timers: [],

      addTimer: (id, recipeId, label, durationMs, recipeName) => {
        const existing = get().timers.find((t) => t.id === id);
        if (existing) return;

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
              status: "paused" as TimerStatus,
              lastTickAt: null,
            },
          ],
        }));
      },

      removeTimer: (id) => {
        set((state) => ({
          timers: state.timers.filter((t) => t.id !== id),
        }));

        const remaining = get().timers;
        if (remaining.length === 0) {
          void endLiveActivity();
          void dismissAllTimerNotifications();
        }
      },

      clearAll: () => {
        set({ timers: [] });
        void endLiveActivity();
        void dismissAllTimerNotifications();
      },

      startTimer: (id) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id ? { ...t, status: "running" as TimerStatus, lastTickAt: Date.now() } : t
          ),
        }));
      },

      pauseTimer: (id) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id ? { ...t, status: "paused" as TimerStatus, lastTickAt: null } : t
          ),
        }));
      },

      resetTimer: (id) => {
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: "paused" as TimerStatus,
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
              void showTimerNotification(t);
              return { ...t, remainingMs: 0, status: "completed" as TimerStatus, lastTickAt: now };
            }

            hasChanges = true;
            return { ...t, remainingMs: newRemaining, lastTickAt: now } as Timer;
          });

          if (hasChanges) {
            const activeTimers = newTimers.filter(
              (t) => t.status === "running" || t.status === "paused" || t.status === "completed"
            );
            const sortedTimers = [...activeTimers].sort((a, b) => {
              if (a.status === "completed" && b.status !== "completed") return -1;
              if (b.status === "completed" && a.status !== "completed") return 1;
              return a.remainingMs - b.remainingMs;
            });

            if (sortedTimers.length > 0) {
              void startOrUpdateLiveActivity(sortedTimers[0]!, sortedTimers.length);
            } else {
              void endLiveActivity();
            }
          }

          return (hasChanges ? { timers: newTimers } : {}) as Partial<TimerState>;
        });
      },
    }),
    {
      name: "norish-timers",
      storage: createJSONStorage(() => ({
        getItem: (key: string) => {
          return storage.getString(key) ?? null;
        },
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      })),
    }
  )
);
