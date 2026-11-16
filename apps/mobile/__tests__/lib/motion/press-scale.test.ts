// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boxes = vi.hoisted(() => ({ scale: undefined as { get: () => number } | undefined }));

vi.mock("react-native-reanimated", async () => {
  const mock = await import("../../mocks/reanimated");

  return {
    ...mock,
    useSharedValue: (value: number) => (boxes.scale = mock.useSharedValue(value)),
  };
});

const { usePressScale } = await import("@/lib/motion/press-scale");

describe("usePressScale", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("dips only for a finger that rests, not for a touch that scrolls away at once", () => {
    const { result } = renderHook(() => usePressScale());

    act(() => result.current.press(true));
    act(() => vi.advanceTimersByTime(30));
    act(() => result.current.press(false));
    act(() => vi.advanceTimersByTime(300));
    expect(boxes.scale?.get()).toBe(1);

    act(() => result.current.press(true));
    act(() => vi.advanceTimersByTime(120));
    expect(boxes.scale?.get()).toBe(0.96);
    act(() => result.current.press(false));
    expect(boxes.scale?.get()).toBe(1);
  });
});
