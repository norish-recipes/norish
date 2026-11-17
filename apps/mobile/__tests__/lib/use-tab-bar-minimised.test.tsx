// @vitest-environment jsdom
import { useTabBarMinimised } from "@/lib/use-tab-bar-minimised";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let focused = true;

vi.mock("expo-router", () => ({ useIsFocused: () => focused }));
vi.mock("react-native-safe-area-context", () => ({
  initialWindowMetrics: { insets: { bottom: 34 } },
}));

const scroll = (y: number) => ({
  contentOffset: { y },
  contentSize: { height: 2000 },
  layoutMeasurement: { height: 800 },
});

describe("useTabBarMinimised", () => {
  it("guesses the bar expanded again when its tab comes back into focus", () => {
    focused = true;
    const bar = renderHook(() => useTabBarMinimised());

    act(() => bar.result.current.track(scroll(200)));
    expect(bar.result.current.minimised).toBe(true);

    focused = false;
    bar.rerender();
    focused = true;
    bar.rerender();
    expect(bar.result.current.minimised).toBe(false);
  });
});
