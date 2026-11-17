import { describe, expect, it } from "vitest";

import type { Timer } from "../timers";
import { countdownSlots, sortTimers, spokenDuration, timerGlance } from "../timers";

const timer = (
  id: string,
  status: Timer["status"],
  remainingMs: number,
  lastTickAt: number | null = status === "running" ? 1_000 : null
): Timer => ({
  id,
  recipeId: "r",
  label: id,
  originalDurationMs: 600_000,
  remainingMs,
  status,
  lastTickAt,
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

  it("puts a running timer before a paused one that has less time left", () => {
    const sorted = sortTimers([
      timer("paused", "paused", 120_000),
      timer("run", "running", 300_000),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["run", "paused"]);
  });

  it("orders running timers by their wall-clock end, not their stale remaining time", () => {
    const sorted = sortTimers([
      timer("late", "running", 100_000, 50_000),
      timer("early", "running", 120_000, 0),
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(["early", "late"]);
  });

  it("keeps store order for timers that tie", () => {
    const sorted = sortTimers([timer("a", "paused", 60_000), timer("b", "paused", 60_000)]);

    expect(sorted.map((entry) => entry.id)).toEqual(["a", "b"]);
  });
});

describe("timerGlance", () => {
  it("has nothing without timers", () => {
    expect(timerGlance([])).toEqual({ hasTimers: false, soonest: undefined, anyDone: false });
  });

  it("picks the soonest running timer and flags a done one beside it", () => {
    const soonest = timer("short", "running", 60_000);
    const glance = timerGlance([
      timer("long", "running", 300_000),
      soonest,
      timer("done", "completed", 0),
    ]);

    expect(glance).toEqual({ hasTimers: true, soonest, anyDone: true });
  });

  it("shows a paused timer only when none is running", () => {
    const paused = timer("paused", "paused", 60_000);

    expect(timerGlance([paused, timer("run", "running", 300_000)]).soonest?.id).toBe("run");
    expect(timerGlance([paused]).soonest).toBe(paused);
  });

  it("has no countdown when every timer is done", () => {
    expect(timerGlance([timer("done", "completed", 0)])).toMatchObject({
      hasTimers: true,
      soonest: undefined,
      anyDone: true,
    });
  });
});

describe("spokenDuration", () => {
  it("splits the time left into hours, minutes and seconds, rounding up", () => {
    expect(spokenDuration(3_725_000)).toEqual({ hours: 1, minutes: 2, seconds: 5 });
    expect(spokenDuration(59_100)).toEqual({ hours: 0, minutes: 1, seconds: 0 });
  });
});

describe("countdownSlots", () => {
  it("is as wide as the longest of the time left and the full duration", () => {
    expect(countdownSlots(timer("a", "running", 599_000))).toBe(5);
    expect(countdownSlots({ ...timer("b", "running", 9_000), originalDurationMs: 9_000 })).toBe(4);
  });
});
