import type { Virtualizer } from "@tanstack/react-virtual";

type Timeline = Pick<
  Virtualizer<Window, Element>,
  "isScrolling" | "scrollToIndex" | "shouldAdjustScrollPositionOnItemSizeChange"
>;

/**
 * Scrolls a day to the top of the window, holding off TanStack's correction
 * for the days above it while they are measured on the way. The scroll
 * already follows the day to its place, so correcting as well counts their
 * growth twice: iOS applies its deferred correction once the landing has
 * settled, which left today under the status bar.
 */
export function landOnDay(timeline: Timeline, index: number): void {
  timeline.shouldAdjustScrollPositionOnItemSizeChange = () => false;
  timeline.scrollToIndex(index, { align: "start" });
}

/** The virtualizer's `onChange`: once it stops scrolling, TanStack corrects again. */
export function settleLanding(timeline: Timeline): void {
  if (!timeline.isScrolling) timeline.shouldAdjustScrollPositionOnItemSizeChange = undefined;
}
