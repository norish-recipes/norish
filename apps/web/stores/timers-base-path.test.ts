// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TimerStore = typeof import("./timers");

let useTimerStore: TimerStore["useTimerStore"];

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/norish");

  const module = await import("./timers");

  useTimerStore = module.useTimerStore;

  const storage = new Map();

  useTimerStore.persist.setOptions({
    storage: {
      getItem: (name) => storage.get(name) || null,
      setItem: (name, value) => storage.set(name, value),
      removeItem: (name) => storage.delete(name),
    },
  });
  useTimerStore.setState({ timers: [] });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("timer notifications under a base path", () => {
  it("prefixes the notification icon", async () => {
    const showNotification = vi.fn();

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) },
    });

    const { addTimer, startTimer, tick } = useTimerStore.getState();

    addTimer("test-1", "recipe-1", "Test Timer", 1000);
    startTimer("test-1");
    vi.setSystemTime(Date.now() + 2000);
    tick();

    await Promise.resolve();

    expect(showNotification).toHaveBeenCalledWith(
      "Test Timer",
      expect.objectContaining({ icon: "/norish/brand/icon-192.png" })
    );
  });
});
