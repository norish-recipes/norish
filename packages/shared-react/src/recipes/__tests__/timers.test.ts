import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformStorage } from "../../platform";
import {
  connectTimerStorage,
  recipeTimerId,
  timerAdjustStep,
  timerEndsAt,
  useTimerStore,
} from "../timers";

const mapStorage = (entries: Map<string, string> = new Map()): PlatformStorage => ({
  getItem: (key) => entries.get(key) ?? null,
  setItem: (key, value) => void entries.set(key, value),
  removeItem: (key) => void entries.delete(key),
});

describe("useTimerStore", () => {
  beforeEach(() => {
    useTimerStore.setState({ timers: [] });
    connectTimerStorage(mapStorage());
    vi.useFakeTimers();
  });

  it("adds a timer", () => {
    const { addTimer } = useTimerStore.getState();

    addTimer({ id: "test-1", recipeId: "recipe-1", label: "Test Timer", durationMs: 60000 });

    const { timers } = useTimerStore.getState();

    expect(timers).toHaveLength(1);
    expect(timers[0]).toMatchObject({
      id: "test-1",
      recipeId: "recipe-1",
      label: "Test Timer",
      originalDurationMs: 60000,
      remainingMs: 60000,
      status: "paused",
      lastTickAt: null,
    });
  });

  it("adds a timer with recipe name", () => {
    const { addTimer } = useTimerStore.getState();

    addTimer({
      id: "test-1",
      recipeId: "recipe-1",
      label: "Test Timer",
      durationMs: 60000,
      recipeName: "My Recipe",
    });

    const { timers } = useTimerStore.getState();

    expect(timers).toHaveLength(1);
    expect(timers[0]).toMatchObject({
      id: "test-1",
      recipeId: "recipe-1",
      recipeName: "My Recipe",
      label: "Test Timer",
      originalDurationMs: 60000,
      remainingMs: 60000,
      status: "paused",
      lastTickAt: null,
    });
  });

  it("does not duplicate timers with same id", () => {
    const { addTimer } = useTimerStore.getState();

    addTimer({ id: "test-1", recipeId: "recipe-1", label: "Test Timer", durationMs: 60000 });
    addTimer({ id: "test-1", recipeId: "recipe-1", label: "Test Timer", durationMs: 60000 });

    const { timers } = useTimerStore.getState();

    expect(timers).toHaveLength(1);
  });

  it("removes a timer", () => {
    const { addTimer, removeTimer } = useTimerStore.getState();

    addTimer({ id: "test-1", recipeId: "recipe-1", label: "Test Timer", durationMs: 60000 });
    removeTimer("test-1");

    const { timers } = useTimerStore.getState();

    expect(timers).toHaveLength(0);
  });

  it("starts a timer", () => {
    const { addTimer, startTimer } = useTimerStore.getState();

    addTimer({ id: "test-1", recipeId: "recipe-1", label: "Test Timer", durationMs: 60000 });
    startTimer("test-1");

    const { timers } = useTimerStore.getState();

    expect(timers[0]!.status).toBe("running");
    expect(timers[0]!.lastTickAt).not.toBeNull();
  });

  it("pauses a timer", () => {
    const { addTimer, startTimer, pauseTimer } = useTimerStore.getState();

    addTimer({ id: "test-1", recipeId: "recipe-1", label: "Test Timer", durationMs: 60000 });
    startTimer("test-1");
    pauseTimer("test-1");

    const { timers } = useTimerStore.getState();

    expect(timers[0]!.status).toBe("paused");
    expect(timers[0]!.lastTickAt).toBeNull();
  });

  it("resets a timer", () => {
    const { addTimer, startTimer, resetTimer, tick } = useTimerStore.getState();

    addTimer({ id: "test-1", recipeId: "recipe-1", label: "Test Timer", durationMs: 60000 });
    startTimer("test-1");

    // Advance time by 10 seconds
    vi.setSystemTime(Date.now() + 10000);
    tick();

    let { timers } = useTimerStore.getState();

    expect(timers[0]!.remainingMs).toBeLessThan(60000);

    resetTimer("test-1");

    timers = useTimerStore.getState().timers;
    expect(timers[0]!.remainingMs).toBe(60000);
    expect(timers[0]!.status).toBe("paused");
  });

  it("ticks correctly", () => {
    const { addTimer, startTimer, tick } = useTimerStore.getState();

    addTimer({ id: "test-1", recipeId: "recipe-1", label: "Test Timer", durationMs: 60000 });
    startTimer("test-1");

    // Advance time by 1 second
    const now = Date.now();

    vi.setSystemTime(now + 1000);
    tick();

    const { timers } = useTimerStore.getState();
    const expectedRemainingIds = 60000 - 1000;

    // Allow for slight execution delays
    expect(timers[0]!.remainingMs).toBeCloseTo(expectedRemainingIds, -2);
  });

  it("completes a timer", () => {
    const { addTimer, startTimer, tick } = useTimerStore.getState();

    addTimer({ id: "test-1", recipeId: "recipe-1", label: "Test Timer", durationMs: 1000 });
    startTimer("test-1");

    // Advance time by 2 seconds (past duration)
    vi.setSystemTime(Date.now() + 2000);
    tick();

    const { timers } = useTimerStore.getState();

    expect(timers[0]!.remainingMs).toBe(0);
    expect(timers[0]!.status).toBe("completed");
  });

  it("adjusts timer duration", () => {
    const { addTimer, adjustTimer } = useTimerStore.getState();

    addTimer({ id: "test-adj", recipeId: "recipe-1", label: "Adjust Timer", durationMs: 60000 });

    // Add 1 minute
    adjustTimer("test-adj", 60000);
    expect(useTimerStore.getState().timers[0]!.remainingMs).toBe(120000);

    // Subtract 30 seconds
    adjustTimer("test-adj", -30000);
    expect(useTimerStore.getState().timers[0]!.remainingMs).toBe(90000);

    // Subtract to zero -> verify completion
    adjustTimer("test-adj", -100000); // More than remaining
    let t = useTimerStore.getState().timers[0]!;

    expect(t.remainingMs).toBe(0);
    expect(t.status).toBe("completed");

    // Add time to completed timer -> verify restart
    adjustTimer("test-adj", 30000);
    t = useTimerStore.getState().timers[0]!;
    expect(t.remainingMs).toBe(30000);
    expect(t.status).toBe("running");
  });

  it("returns the timers that reach zero on a tick", () => {
    const { addTimer, startTimer, tick } = useTimerStore.getState();

    addTimer({ id: "a", recipeId: "recipe-1", label: "A", durationMs: 1000 });
    addTimer({ id: "b", recipeId: "recipe-1", label: "B", durationMs: 5000 });
    startTimer("a");
    startTimer("b");
    vi.setSystemTime(Date.now() + 1500);

    expect(tick().map((timer) => timer.id)).toEqual(["a"]);
    expect(tick()).toEqual([]);
  });
});

describe("recipeTimerId", () => {
  it("names a step's timer by recipe, step and place", () => {
    expect(recipeTimerId("recipe-1", 2, 0)).toBe("recipe-1-s2-0");
  });

  it("loads, ticks and dismisses a stored timer whose id no current step produces", async () => {
    const legacy = {
      // recipeTimerId always ends in -s<step>-<place>; this one cannot come from it.
      id: "recipe-1-step-3",
      recipeId: "recipe-1",
      label: "Step 4 Timer",
      originalDurationMs: 60_000,
      remainingMs: 60_000,
      status: "running",
      lastTickAt: Date.now(),
    };
    const entries = new Map([
      ["norish-timers", JSON.stringify({ state: { timers: [legacy] }, version: 0 })],
    ]);

    expect(legacy.id).not.toMatch(/-s\d+-\d+$/);
    useTimerStore.setState({ timers: [] });
    connectTimerStorage(mapStorage(entries));
    await Promise.resolve();
    vi.setSystemTime(Date.now() + 1_000);
    useTimerStore.getState().tick();

    expect(useTimerStore.getState().timers[0]).toMatchObject({
      id: legacy.id,
      remainingMs: 59_000,
    });
    useTimerStore.getState().removeTimer(legacy.id);
    expect(useTimerStore.getState().timers).toEqual([]);
  });
});

describe("timerAdjustStep", () => {
  it("steps 10 seconds under 5 minutes, a minute under 20, else 5 minutes", () => {
    expect(timerAdjustStep(4 * 60_000)).toBe(10_000);
    expect(timerAdjustStep(5 * 60_000)).toBe(60_000);
    expect(timerAdjustStep(20 * 60_000)).toBe(300_000);
  });
});

describe("timerEndsAt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTimerStore.setState({ timers: [] });
  });

  it("stays put across ticks and moves with an adjust; none while paused", () => {
    const { addTimer, startTimer, tick, adjustTimer, pauseTimer } = useTimerStore.getState();
    const start = Date.now();
    const timer = () => useTimerStore.getState().timers[0]!;

    addTimer({
      id: "t",
      recipeId: "recipe-1",
      label: "Simmer",
      durationMs: 60_000,
      recipeName: "Risotto",
      stepIndex: 3,
    });
    expect(timer().stepIndex).toBe(3);
    expect(timerEndsAt(timer())).toBeNull();

    startTimer("t");
    vi.setSystemTime(start + 10_250);
    tick();
    expect(timerEndsAt(timer())).toBe(start + 60_000);

    adjustTimer("t", 10_000);
    expect(timerEndsAt(timer())).toBe(start + 70_000);

    pauseTimer("t");
    expect(timerEndsAt(timer())).toBeNull();
  });
});

describe("connectTimerStorage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTimerStore.setState({ timers: [] });
  });

  it("rebuilds a running timer from the wall clock after a cold start", async () => {
    const entries = new Map<string, string>();

    connectTimerStorage(mapStorage(entries));
    useTimerStore
      .getState()
      .addTimer({ id: "t", recipeId: "recipe-1", label: "Simmer", durationMs: 60_000 });
    useTimerStore.getState().startTimer("t");
    // The app is killed: the store forgets, the stored copy stays.
    useTimerStore.setState({ timers: [] }, false);
    entries.set(
      "norish-timers",
      JSON.stringify({
        state: {
          timers: [
            {
              id: "t",
              recipeId: "recipe-1",
              label: "Simmer",
              originalDurationMs: 60_000,
              remainingMs: 60_000,
              status: "running",
              lastTickAt: Date.now(),
            },
          ],
        },
        version: 0,
      })
    );
    vi.setSystemTime(Date.now() + 45_000);

    connectTimerStorage(mapStorage(entries));
    await Promise.resolve();
    useTimerStore.getState().tick();

    expect(useTimerStore.getState().timers[0]).toMatchObject({
      remainingMs: 15_000,
      status: "running",
    });
  });

  it("keeps the stored timers and the one added before the app connected its storage", async () => {
    vi.resetModules();
    const fresh = await import("../timers");
    const stored = JSON.stringify({
      state: {
        timers: [
          {
            id: "kept",
            recipeId: "r",
            label: "Kept",
            originalDurationMs: 1,
            remainingMs: 1,
            status: "paused",
            lastTickAt: null,
          },
        ],
      },
      version: 0,
    });
    const entries = new Map([["norish-timers", stored]]);

    fresh.useTimerStore
      .getState()
      .addTimer({ id: "early", recipeId: "r", label: "Early", durationMs: 1000 });
    expect(entries.get("norish-timers")).toBe(stored);

    fresh.connectTimerStorage(mapStorage(entries));
    await Promise.resolve();

    expect(fresh.useTimerStore.getState().timers.map((timer) => timer.id)).toEqual([
      "kept",
      "early",
    ]);
  });
});
