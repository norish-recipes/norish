import { useTimerStore } from "@/stores/timers";
import { afterEach, describe, expect, it, vi } from "vitest";

const warn = vi.hoisted(() => vi.fn());

vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() }),
}));

describe("timer completion in the background", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useTimerStore.setState({ timers: [] });
  });

  it("logs a notification the service worker refuses instead of leaving it unhandled", async () => {
    const refusal = new Error("notifications blocked");

    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    vi.stubGlobal("Notification", { permission: "granted" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification: () => Promise.reject(refusal) }) },
    });
    useTimerStore.setState({
      timers: [
        {
          id: "r1-0-0",
          recipeId: "r1",
          label: "Simmer",
          originalDurationMs: 1000,
          remainingMs: 1000,
          status: "running",
          lastTickAt: Date.now() - 2000,
        },
      ],
    });

    useTimerStore.getState().tick();

    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(refusal, "Failed to show timer notification")
    );
  });
});
