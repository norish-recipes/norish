import { TimerTicker } from "@/components/timer-dock";
import { useTimerStore } from "@/lib/timers";
import { act, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import common from "@norish/i18n/messages/nl/common.json";

describe("a timer completing in the background", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "serviceWorker");
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useTimerStore.setState({ timers: [] });
  });

  it("notifies in the reader's language", async () => {
    const showNotification = vi.fn();

    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    vi.stubGlobal("Notification", { permission: "granted" });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) },
    });
    useTimerStore.setState({
      timers: [
        {
          id: "r1-0-0",
          recipeId: "r1",
          recipeName: "Risotto",
          label: "Simmer",
          originalDurationMs: 1000,
          remainingMs: 1000,
          status: "running",
          lastTickAt: Date.now() - 2000,
        },
      ],
    });

    render(
      <NextIntlClientProvider locale="nl" messages={{ common }}>
        <TimerTicker />
      </NextIntlClientProvider>
    );
    await act(() => vi.advanceTimersByTimeAsync(1000));

    await vi.waitFor(() =>
      expect(showNotification).toHaveBeenCalledWith(
        "Timer afgelopen",
        expect.objectContaining({ body: "Simmer — Risotto is klaar!" })
      )
    );
  });
});
