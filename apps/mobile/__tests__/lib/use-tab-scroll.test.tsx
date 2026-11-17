// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let focused = true;

vi.mock("expo-router", () => ({ useIsFocused: () => focused }));
vi.mock("react-native-safe-area-context", () => ({
  initialWindowMetrics: { insets: { bottom: 34 } },
  useSafeAreaInsets: () => ({ top: 62, bottom: 34 }),
}));
// The scroll handler runs as plain JS, crossing to JS at once; shared values live across renders.
vi.mock("react-native-reanimated", async () => {
  const reanimated = await import("../mocks/reanimated");
  const { useState } = await import("react");

  return {
    ...reanimated,
    useAnimatedScrollHandler: (handler: unknown) => handler,
    useSharedValue: <T,>(value: T) => useState(() => reanimated.useSharedValue(value))[0],
  };
});
vi.mock("react-native-worklets", () => ({
  scheduleOnRN: <T,>(fn: (value: T) => void, value: T) => fn(value),
}));

const { useTabScroll } = await import("@/lib/use-tab-scroll");

const scroll = (y: number) => ({
  contentOffset: { y },
  contentSize: { height: 2000 },
  layoutMeasurement: { height: 800 },
});

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

  it("guesses the bar expanded again when its tab comes back into focus", () => {
    focused = true;
    const { bar, onScroll } = render();

    act(() => onScroll(scroll(200)));
    expect(bar.result.current.minimised).toBe(true);

    focused = false;
    bar.rerender();
    focused = true;
    bar.rerender();
    expect(bar.result.current.minimised).toBe(false);

    act(() => onScroll(scroll(400)));
    expect(bar.result.current.minimised).toBe(true);
  });
});
