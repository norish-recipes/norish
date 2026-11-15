// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Keyboard: { metrics: () => ({ screenY: 500 }), addListener: () => ({ remove: () => {} }) },
}));
vi.mock("react-native-reanimated", () => ({
  useAnimatedScrollHandler: () => () => {},
  useSharedValue: (value: number) => ({ value }),
}));

const { useFocusedFieldInView } = await import("@/hooks/use-focused-field-in-view");

describe("useFocusedFieldInView", () => {
  it("brings the focused field up again once the content grows under it", () => {
    vi.stubGlobal("requestAnimationFrame", (run: () => void) => run());
    const { result } = renderHook(() => useFocusedFieldInView(100));
    const scrollTo = vi.fn();
    // A row focused by Return: laid out above the pill first, pushed under it once the list grows.
    let top = 300;
    const field = {
      measureInWindow: (report: (...box: number[]) => void) => report(0, top, 0, 40),
    };

    Object.assign(result.current.scrollRef, { current: { scrollTo } });
    act(() => result.current.onFieldFocus(field));
    expect(scrollTo).not.toHaveBeenCalled();
    top = 420;
    act(() => result.current.onContentSizeChange());

    expect(scrollTo).toHaveBeenCalledWith({ y: 60, animated: true });
    vi.unstubAllGlobals();
  });
});
