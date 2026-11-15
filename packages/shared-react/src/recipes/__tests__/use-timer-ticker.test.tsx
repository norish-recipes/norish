import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTimerStore, useTimerTicker } from "../timers";

describe("useTimerTicker", () => {
  afterEach(() => {
    vi.useRealTimers();
    useTimerStore.setState({ timers: [] });
  });

  it("hands each timer that finishes to the notifier once", async () => {
    vi.useFakeTimers();
    const finished = vi.fn();

    useTimerStore
      .getState()
      .addTimer({ id: "t", recipeId: "recipe-1", label: "Simmer", durationMs: 1500 });
    useTimerStore.getState().startTimer("t");
    renderHook(() => useTimerTicker(finished));

    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(finished).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledWith(expect.objectContaining({ id: "t" }));
    expect(useTimerStore.getState().timers[0]?.status).toBe("completed");
  });
});
