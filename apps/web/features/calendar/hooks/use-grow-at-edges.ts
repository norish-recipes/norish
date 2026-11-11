import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { hasReachedDay } from "@/components/calendar/land-on-day";

type GrowAtEdgesArgs = {
  virtualizer: Pick<Virtualizer<Window, Element>, "scrollOffset">;
  virtualItems: VirtualItem[];
  /** Rows on desktop, days on a phone. */
  count: number;
  todayIndex: number;
  /** How close to the first row a scroll rests before the past grows. */
  startEdge: number;
  hasScrolledRef: RefObject<boolean>;
  captureAnchor: (anchor: { index: number; itemStart: number; scrollOffset: number }) => void;
  isGrowing: boolean;
  grow: (direction: "past" | "future") => void;
};

/** Grows the range once per approach to an edge, after the landing on today has arrived. */
export function useGrowAtEdges({
  virtualizer,
  virtualItems,
  count,
  todayIndex,
  startEdge,
  hasScrolledRef,
  captureAnchor,
  isGrowing,
  grow,
}: GrowAtEdgesArgs) {
  const hasLandedRef = useRef(false);
  const hasGrownPastRef = useRef(false);
  const hasGrownFutureRef = useRef(false);

  useEffect(() => {
    if (virtualItems.length === 0 || !hasScrolledRef.current) return;
    if (!hasLandedRef.current) {
      if (!hasReachedDay(virtualItems, todayIndex)) return;
      hasLandedRef.current = true;
    }

    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];

    if (!firstItem || !lastItem) return;

    const isNearStart = firstItem.index <= startEdge;
    const isNearEnd = lastItem.index >= count - 2;

    if (isNearStart && !isGrowing && !hasGrownPastRef.current) {
      captureAnchor({
        index: firstItem.index,
        itemStart: firstItem.start,
        scrollOffset: virtualizer.scrollOffset ?? 0,
      });

      hasGrownPastRef.current = true;
      grow("past");
    }
    if (!isNearStart) {
      hasGrownPastRef.current = false;
    }

    if (isNearEnd && !isGrowing && !hasGrownFutureRef.current) {
      hasGrownFutureRef.current = true;
      grow("future");
    }
    if (!isNearEnd) {
      hasGrownFutureRef.current = false;
    }
  }, [
    virtualItems,
    count,
    startEdge,
    isGrowing,
    grow,
    virtualizer,
    captureAnchor,
    todayIndex,
    hasScrolledRef,
  ]);
}
