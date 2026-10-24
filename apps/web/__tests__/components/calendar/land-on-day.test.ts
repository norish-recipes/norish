import { hasReachedDay, landOnDay, settleLanding } from "@/components/calendar/land-on-day";
import { describe, expect, it, vi } from "vitest";

function timeline() {
  return {
    isScrolling: false,
    scrollToIndex: vi.fn(),
    shouldAdjustScrollPositionOnItemSizeChange: undefined as
      undefined | ((...args: unknown[]) => boolean),
  };
}

describe("landOnDay", () => {
  it("scrolls the day to the top with size corrections held off", () => {
    const t = timeline();

    landOnDay(t, 15);

    expect(t.scrollToIndex).toHaveBeenCalledWith(15, { align: "start" });
    expect(t.shouldAdjustScrollPositionOnItemSizeChange?.()).toBe(false);
  });

  it("hands corrections back to TanStack only once the scroll has stopped", () => {
    const t = timeline();

    landOnDay(t, 15);
    t.isScrolling = true;
    settleLanding(t);
    expect(t.shouldAdjustScrollPositionOnItemSizeChange).toBeDefined();

    t.isScrolling = false;
    settleLanding(t);
    expect(t.shouldAdjustScrollPositionOnItemSizeChange).toBeUndefined();
  });
});

describe("hasReachedDay", () => {
  it("waits until the window holds the day the landing was for", () => {
    // Right after the landing is asked for, the window still shows the top.
    expect(hasReachedDay([{ index: 0 }, { index: 1 }, { index: 2 }], 4)).toBe(false);
    expect(hasReachedDay([{ index: 3 }, { index: 4 }, { index: 5 }], 4)).toBe(true);
  });

  it("does not wait for a day outside the range", () => {
    expect(hasReachedDay([{ index: 0 }], -1)).toBe(true);
  });
});
