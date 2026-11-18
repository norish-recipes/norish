// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native-safe-area-context", () => ({
  initialWindowMetrics: { insets: { bottom: 34 } },
  useSafeAreaInsets: () => ({ top: 62, bottom: 34 }),
}));
// The scroll handler runs as plain JS; shared values live across renders.
vi.mock("react-native-reanimated", async () => {
  const reanimated = await import("../mocks/reanimated");
  const { useState } = await import("react");

  return {
    ...reanimated,
    useAnimatedScrollHandler: (handler: unknown) => handler,
    useSharedValue: <T,>(value: T) => useState(() => reanimated.useSharedValue(value))[0],
  };
});

const { useTabScroll } = await import("@/lib/use-tab-scroll");

const scroll = (y: number) => ({ contentOffset: { y } });

function render() {
  const bar = renderHook(() => useTabScroll());
  const onScroll = bar.result.current.onScroll as unknown as (
    event: ReturnType<typeof scroll>
  ) => void;

  return { bar, onScroll };
}

describe("useTabScroll", () => {
  it("measures the offset from the list's rest under the bar", () => {
    const { bar, onScroll } = render();

    act(() => onScroll(scroll(-116 + 20)));
    expect(bar.result.current.offset.value).toBe(20);
  });
});
