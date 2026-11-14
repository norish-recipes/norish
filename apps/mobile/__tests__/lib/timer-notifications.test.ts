import { planTimerNotifications, timerNotificationId } from "@/lib/timer-notifications";
import { describe, expect, it, vi } from "vitest";

import type { Timer } from "@norish/shared-react/recipes/timers";

vi.mock("expo-notifications", () => ({}));

const NOW = 1_000_000;

const timer = (id: string, overrides: Partial<Timer> = {}): Timer => ({
  id,
  recipeId: "r",
  label: "Step 1",
  originalDurationMs: 60_000,
  remainingMs: 60_000,
  status: "running",
  lastTickAt: NOW,
  ...overrides,
});

describe("planTimerNotifications", () => {
  it("schedules a started timer at its end and leaves an unchanged one", () => {
    const started = timer("a");
    const unchanged = timer("b", { remainingMs: 30_000 });

    expect(
      planTimerNotifications([started, unchanged], [timerNotificationId("b", NOW + 30_000)], NOW)
    ).toEqual({
      cancel: [],
      schedule: [
        {
          identifier: timerNotificationId("a", NOW + 60_000),
          timer: started,
          endsAt: NOW + 60_000,
        },
      ],
    });
  });

  it("cancels on pause, reset and removal", () => {
    const scheduled = ["a", "b", "c"].map((id) => timerNotificationId(id, NOW + 60_000));
    const plan = planTimerNotifications(
      [
        timer("a", { status: "paused", lastTickAt: null }),
        timer("b", { status: "paused", lastTickAt: null, remainingMs: 60_000 }),
      ],
      scheduled,
      NOW
    );

    expect(plan).toEqual({ cancel: scheduled, schedule: [] });
  });

  it("moves the notification when a timer is adjusted or resumed", () => {
    const adjusted = timer("a", { remainingMs: 90_000 });
    const plan = planTimerNotifications([adjusted], [timerNotificationId("a", NOW + 60_000)], NOW);

    expect(plan.cancel).toEqual([timerNotificationId("a", NOW + 60_000)]);
    expect(plan.schedule.map((entry) => entry.endsAt)).toEqual([NOW + 90_000]);
  });

  it("keeps two timers on one step apart", () => {
    const plan = planTimerNotifications(
      [timer("r-s0-0"), timer("r-s0-1", { remainingMs: 5000 })],
      [],
      NOW
    );

    expect(plan.schedule.map((entry) => entry.identifier)).toEqual([
      timerNotificationId("r-s0-0", NOW + 60_000),
      timerNotificationId("r-s0-1", NOW + 5000),
    ]);
  });

  it("leaves a notification firing as its timer finishes, but drops one a timer adjusted to zero left behind", () => {
    const done = timer("a", { status: "completed", remainingMs: 0 });
    const zeroed = timer("b", { status: "completed", remainingMs: 0 });
    const plan = planTimerNotifications(
      [done, zeroed],
      [timerNotificationId("a", NOW), timerNotificationId("b", NOW + 50_000)],
      NOW
    );

    expect(plan).toEqual({ cancel: [timerNotificationId("b", NOW + 50_000)], schedule: [] });
  });

  it("schedules nothing for a timer that ran out while the app was closed, and ignores other notifications", () => {
    const ranOut = timer("a", { lastTickAt: NOW - 120_000 });

    expect(planTimerNotifications([ranOut], ["something-else"], NOW)).toEqual({
      cancel: [],
      schedule: [],
    });
  });
});
