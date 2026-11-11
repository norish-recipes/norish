/** A timeline lands on today once, grows a side once per resting approach, and scrolls back to today. */
import { useTimelineScroll } from "@/features/calendar/hooks/use-timeline-scroll";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const KEYS = Array.from({ length: 21 }, (_, i) => `day-${i}`);
const TODAY = 10;

/** A window of items from `first` to `last`, as TanStack hands them back. */
const window_ = (first: number, last: number) =>
  Array.from({ length: last - first + 1 }, (_, i) => ({
    index: first + i,
    start: (first + i) * 100,
    end: (first + i + 1) * 100,
    size: 100,
    key: KEYS[first + i] ?? first + i,
    lane: 0,
  }));

function render() {
  let items = window_(0, 4);
  let todayIndex = TODAY;
  const virtualizer = {
    getVirtualItems: () => items,
    isScrolling: false,
    scrollOffset: 0,
    scrollToIndex: vi.fn(),
    scrollToOffset: vi.fn(),
    shouldAdjustScrollPositionOnItemSizeChange: undefined,
  };
  const grow = vi.fn();
  const view = renderHook(() =>
    useTimelineScroll({
      virtualizer,
      keys: KEYS,
      todayIndex,
      isLoading: false,
      isGrowing: false,
      grow,
      pastGrowEdge: 1,
      futureGrowEdge: 2,
      todayBuffer: { past: 1, future: 1 },
    })
  );
  const restAt = (first: number, last: number) => {
    items = window_(first, last);
    view.rerender();
  };
  // The past grew, so today's item sits further down.
  const shiftToday = (by: number) => {
    todayIndex += by;
    view.rerender();
  };
  const landed = () =>
    waitFor(() =>
      expect(virtualizer.scrollToIndex).toHaveBeenCalledWith(TODAY, { align: "start" })
    );

  return { view, virtualizer, grow, restAt, shiftToday, landed };
}

describe("useTimelineScroll", () => {
  it("lands on today once", async () => {
    const { virtualizer, restAt, shiftToday, landed } = render();

    await landed();
    restAt(8, 12);
    shiftToday(3);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(virtualizer.scrollToIndex).toHaveBeenCalledOnce();
  });

  it("grows nothing until the window has reached today", async () => {
    const { grow, restAt, landed } = render();

    await landed();
    restAt(0, 4);

    expect(grow).not.toHaveBeenCalled();
  });

  it("grows a side once while a scroll rests at its edge", async () => {
    const { grow, restAt, landed } = render();

    await landed();
    restAt(8, 12);
    restAt(1, 5);
    restAt(0, 4);
    expect(grow).toHaveBeenCalledExactlyOnceWith("past");

    restAt(15, 19);
    restAt(16, 20);
    expect(grow).toHaveBeenCalledTimes(2);
    expect(grow).toHaveBeenLastCalledWith("future");

    // Leaving an edge and coming back to it grows that side again.
    restAt(8, 12);
    restAt(0, 4);
    expect(grow).toHaveBeenCalledTimes(3);
    expect(grow).toHaveBeenLastCalledWith("past");
  });

  it("scrolls to today's item", async () => {
    const { view, virtualizer, landed } = render();

    await landed();
    act(() => view.result.current.scrollToToday());

    expect(virtualizer.scrollToIndex).toHaveBeenLastCalledWith(TODAY, {
      align: "start",
      behavior: "smooth",
    });
  });
});
