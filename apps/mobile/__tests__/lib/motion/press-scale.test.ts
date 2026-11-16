// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boxes = vi.hoisted(() => ({ sets: [] as number[] }));

vi.mock("react-native-reanimated", async () => {
  const mock = await import("../../mocks/reanimated");

  return {
    ...mock,
    useSharedValue: (value: number) => {
      const box = mock.useSharedValue(value);
      const set = box.set;

      box.set = (next: number) => {
        boxes.sets.push(next);
        set(next);
      };

      return box;
    },
  };
});

const { usePressScale } = await import("@/lib/motion/press-scale");

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("usePressScale", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    boxes.sets = [];
  });
  afterEach(() => vi.useRealTimers());

  it("dips and returns for a quick tap that lifts before the delay", () => {
    const { result } = renderHook(() => usePressScale());

    act(() => result.current.press(true));
    wait(30);
    act(() => result.current.press(false, true));
    wait(300);
    expect(boxes.sets).toEqual([0.96, 1]);
  });

  it("dips after the delay for a held press and returns on lift", () => {
    const { result } = renderHook(() => usePressScale());

    act(() => result.current.press(true));
    wait(120);
    expect(boxes.sets).toEqual([0.96]);
    act(() => result.current.press(false));
    act(() => result.current.press(false, true));
    expect(boxes.sets).toEqual([0.96, 1]);
  });

  it("dips for a tap whose lift was reported before the tap", () => {
    const { result } = renderHook(() => usePressScale());

    act(() => result.current.press(true));
    wait(30);
    act(() => result.current.press(false));
    act(() => result.current.press(false, true));
    wait(300);
    expect(boxes.sets).toEqual([0.96, 1]);
  });

  it("plays nothing for a touch that scrolls or swipes away", () => {
    const { result } = renderHook(() => usePressScale());

    act(() => result.current.press(true));
    wait(30);
    act(() => result.current.press(false));
    wait(300);
    expect(boxes.sets).toEqual([]);
  });
});
