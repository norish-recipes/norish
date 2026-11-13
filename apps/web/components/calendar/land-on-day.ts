import type { Virtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";
import { useEffect } from "react";

/** The page's own timeline scrolls the window; a panel's scrolls an element. */
type Timeline<TScroll extends Element | Window> = Pick<
  Virtualizer<TScroll, Element>,
  "isScrolling" | "scrollToIndex" | "shouldAdjustScrollPositionOnItemSizeChange"
>;

/**
 * Scrolls a day to the top with TanStack's size correction off: the scroll already follows the days
 * above as they are measured, and correcting too (deferred on iOS) hid today under the status bar.
 */
export function landOnDay<TScroll extends Element | Window>(
  timeline: Timeline<TScroll>,
  index: number
): void {
  timeline.shouldAdjustScrollPositionOnItemSizeChange = () => false;
  timeline.scrollToIndex(index, { align: "start" });
}

/** The virtualizer's `onChange`: once it stops scrolling, TanStack corrects again. */
export function settleLanding<TScroll extends Element | Window>(timeline: Timeline<TScroll>): void {
  if (!timeline.isScrolling) timeline.shouldAdjustScrollPositionOnItemSizeChange = undefined;
}

/** Lands on `index` once, a frame after the days are drawn, and marks `landingAskedRef`. */
export function useLandOnDay<TScroll extends Element | Window>(
  timeline: Timeline<TScroll>,
  index: number,
  isLoading: boolean,
  landingAskedRef: RefObject<boolean>
) {
  useEffect(() => {
    if (landingAskedRef.current || isLoading || index < 0) return;
    const frame = requestAnimationFrame(() => {
      landOnDay(timeline, index);
      landingAskedRef.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, [isLoading, index, timeline, landingAskedRef]);
}
