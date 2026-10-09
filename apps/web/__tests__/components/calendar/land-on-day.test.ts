import { landOnDay, settleLanding } from "@/components/calendar/land-on-day";
import { describe, expect, it, vi } from "vitest";

function timeline() {
  return {
    isScrolling: false,
    scrollToIndex: vi.fn(),
    shouldAdjustScrollPositionOnItemSizeChange: undefined as
      undefined | ((...args: never[]) => boolean),
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
