import { sortTimers, timerGlance } from "@/lib/timer-order";
import { describe, expect, it } from "vitest";

import type { Timer } from "@norish/shared-react/recipes/timers";

const timer = (id: string, status: Timer["status"], remainingMs: number): Timer => ({
  id,
  recipeId: "r",
  label: id,
  originalDurationMs: 600_000,
  remainingMs,
  status,
  lastTickAt: null,
});

describe("sortTimers", () => {
  it("puts done timers first, then the soonest to finish", () => {
    const sorted = sortTimers([
      timer("long", "running", 300_000),
      timer("done", "completed", 0),
      timer("short", "running", 60_000),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["done", "short", "long"]);
  });
});

describe("timerGlance", () => {
  it("has nothing without timers", () => {
    expect(timerGlance([])).toEqual({ any: false, soonest: undefined, anyDone: false });
  });

  it("picks the soonest of several timers and flags a done one beside it", () => {
    const soonest = timer("short", "running", 60_000);
    const glance = timerGlance([
      timer("long", "running", 300_000),
      soonest,
      timer("done", "completed", 0),
    ]);

    expect(glance).toEqual({ any: true, soonest, anyDone: true });
  });

  it("has no countdown when every timer is done", () => {
    expect(timerGlance([timer("done", "completed", 0)])).toMatchObject({
      any: true,
      soonest: undefined,
      anyDone: true,
    });
  });
});
