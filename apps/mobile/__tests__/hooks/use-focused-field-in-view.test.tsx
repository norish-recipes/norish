// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const keyboardShown = vi.hoisted(() => ({ fire: () => {} }));

vi.mock("react-native", () => ({
  Keyboard: {
    metrics: () => ({ screenY: 500 }),
    addListener: (_event: string, listener: () => void) => {
      keyboardShown.fire = listener;

      return { remove: () => {} };
    },
  },
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

  it("asks again once a container that resizes after the keyboard has settled", () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    vi.stubGlobal("requestAnimationFrame", (run: () => void) => run());
    const { result } = renderHook(() => useFocusedFieldInView(100, 300));
    const scrollToOffset = vi.fn();
    // A sheet's list: the field still sits where it was until the sheet's padding has animated.
    let top = 300;
    const field = {
      measureInWindow: (report: (...box: number[]) => void) => report(0, top, 0, 40),
    };

    Object.assign(result.current.scrollRef, { current: { scrollToOffset } });
    act(() => result.current.onFieldFocus(field));
    act(() => keyboardShown.fire());
    expect(scrollToOffset).not.toHaveBeenCalled();
    top = 420;
    act(() => vi.advanceTimersByTime(300));

    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 60, animated: true });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
