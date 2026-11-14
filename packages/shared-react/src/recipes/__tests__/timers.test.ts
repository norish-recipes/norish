import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlatformStorage } from "../../platform";
import { connectTimerStorage, useTimerStore } from "../timers";

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

    addTimer("test-1", "recipe-1", "Test Timer", 60000);

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

    addTimer("test-1", "recipe-1", "Test Timer", 60000, "My Recipe");

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

    addTimer("test-1", "recipe-1", "Test Timer", 60000);
    addTimer("test-1", "recipe-1", "Test Timer", 60000);

    const { timers } = useTimerStore.getState();

    expect(timers).toHaveLength(1);
  });

  it("removes a timer", () => {
    const { addTimer, removeTimer } = useTimerStore.getState();

    addTimer("test-1", "recipe-1", "Test Timer", 60000);
    removeTimer("test-1");

    const { timers } = useTimerStore.getState();

    expect(timers).toHaveLength(0);
  });

  it("starts a timer", () => {
    const { addTimer, startTimer } = useTimerStore.getState();

    addTimer("test-1", "recipe-1", "Test Timer", 60000);
    startTimer("test-1");

    const { timers } = useTimerStore.getState();

    expect(timers[0]!.status).toBe("running");
    expect(timers[0]!.lastTickAt).not.toBeNull();
  });

  it("pauses a timer", () => {
    const { addTimer, startTimer, pauseTimer } = useTimerStore.getState();

    addTimer("test-1", "recipe-1", "Test Timer", 60000);
    startTimer("test-1");
    pauseTimer("test-1");

    const { timers } = useTimerStore.getState();

    expect(timers[0]!.status).toBe("paused");
    expect(timers[0]!.lastTickAt).toBeNull();
  });

  it("resets a timer", () => {
    const { addTimer, startTimer, resetTimer, tick } = useTimerStore.getState();

    addTimer("test-1", "recipe-1", "Test Timer", 60000);
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

    addTimer("test-1", "recipe-1", "Test Timer", 60000);
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

    addTimer("test-1", "recipe-1", "Test Timer", 1000);
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

    addTimer("test-adj", "recipe-1", "Adjust Timer", 60000);

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

    addTimer("a", "recipe-1", "A", 1000);
    addTimer("b", "recipe-1", "B", 5000);
    startTimer("a");
    startTimer("b");
    vi.setSystemTime(Date.now() + 1500);

    expect(tick().map((timer) => timer.id)).toEqual(["a"]);
    expect(tick()).toEqual([]);
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
    useTimerStore.getState().addTimer("t", "recipe-1", "Simmer", 60_000);
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

  it("keeps the stored timers when one was added before the app connected its storage", async () => {
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

    fresh.useTimerStore.getState().addTimer("early", "r", "Early", 1000);
    expect(entries.get("norish-timers")).toBe(stored);

    fresh.connectTimerStorage(mapStorage(entries));
    await Promise.resolve();

    expect(fresh.useTimerStore.getState().timers.map((timer) => timer.id)).toContain("kept");
  });
});
