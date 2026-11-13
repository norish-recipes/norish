// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (state: string) => void;
const state = vi.hoisted(() => ({ listener: undefined as Listener | undefined }));

vi.mock("react-native", () => ({
  AppState: {
    currentState: "active",
    addEventListener: (_: string, listener: Listener) => {
      state.listener = listener;

      return { remove: () => (state.listener = undefined) };
    },
  },
}));

const { useReopenOnNextMeal } = await import("@/features/recipes/hooks/use-reopen-on-next-meal");

describe("useReopenOnNextMeal", () => {
  beforeEach(() => (state.listener = undefined));

  it("reopens on returning from the background, not from inactive", () => {
    const reopen = vi.fn();

    renderHook(() => useReopenOnNextMeal(reopen, 1));
    state.listener?.("inactive");
    state.listener?.("active");
    expect(reopen).not.toHaveBeenCalled();

    state.listener?.("background");
    state.listener?.("active");
    expect(reopen).toHaveBeenCalledTimes(1);
  });

  it("reopens when the day changes, not on mount", () => {
    const reopen = vi.fn();
    const { rerender } = renderHook(({ day }) => useReopenOnNextMeal(reopen, day), {
      initialProps: { day: 1 },
    });

    expect(reopen).not.toHaveBeenCalled();
    rerender({ day: 2 });
    expect(reopen).toHaveBeenCalledTimes(1);
  });
});
