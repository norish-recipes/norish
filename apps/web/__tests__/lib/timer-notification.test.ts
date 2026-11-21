// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const warn = vi.hoisted(() => vi.fn());

vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() }),
}));

const timer = { label: "Test Timer", recipeName: undefined };

/** A hidden page with granted permission whose service worker answers with `registration`. */
function inBackground(registration: { showNotification: (...args: unknown[]) => unknown }) {
  vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  vi.stubGlobal("Notification", { permission: "granted" });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  });
}

describe("showTimerNotification", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("uses high-attention notification options in the background", async () => {
    const { showTimerNotification } = await import("@/lib/timer-notification");
    const showNotification = vi.fn();

    inBackground({ showNotification });
    showTimerNotification(timer, "Timer complete!");
    await Promise.resolve();

    expect(showNotification).toHaveBeenCalledWith(
      "Test Timer",
      expect.objectContaining({
        body: "Timer complete!",
        icon: "/brand/icon-192.png",
        tag: "timer-complete",
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
      })
    );
  });

  it("prefixes the icon under a base path", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/norish");
    const { showTimerNotification } = await import("@/lib/timer-notification");
    const showNotification = vi.fn();

    inBackground({ showNotification });
    showTimerNotification(timer, "Timer complete!");
    await Promise.resolve();

    expect(showNotification).toHaveBeenCalledWith(
      "Test Timer",
      expect.objectContaining({ icon: "/norish/brand/icon-192.png" })
    );
  });

  it("logs a notification the service worker refuses instead of leaving it unhandled", async () => {
    const { showTimerNotification } = await import("@/lib/timer-notification");
    const refusal = new Error("notifications blocked");

    inBackground({ showNotification: () => Promise.reject(refusal) });
    showTimerNotification(timer, "Timer complete!");

    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(refusal, "Failed to show timer notification")
    );
  });
});
