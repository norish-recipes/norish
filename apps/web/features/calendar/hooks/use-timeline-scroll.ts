import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { hasReachedDay, landOnDay } from "@/components/calendar/land-on-day";
import { usePrependAnchorRestore } from "@/features/calendar/hooks/use-prepend-anchor-restore";

type TimelineScrollArgs = {
  virtualizer: Pick<
    Virtualizer<Window, Element>,
    | "isScrolling"
    | "scrollOffset"
    | "scrollToIndex"
    | "scrollToOffset"
    | "shouldAdjustScrollPositionOnItemSizeChange"
  > & { getVirtualItems: () => VirtualItem[] };
  /** One key per virtual item: rows of days on desktop, days on a phone. */
  keys: string[];
  /** Today's item, or -1 when today is outside the range. */
  todayIndex: number;
  isLoading: boolean;
  isGrowing: boolean;
  grow: (direction: "past" | "future") => void;
  /** Items from the first at or within which a resting scroll grows the past. */
  pastGrowEdge: number;
  /** Items from the last at or within which a resting scroll grows the future. */
  futureGrowEdge: number;
  /** Items today must sit inside the window's first and last before it counts as visible. */
  todayBuffer: { past: number; future: number };
  /** Checks today's visibility a frame after each scroll and first after 100 ms. */
  deferVisibilityCheck?: boolean;
};

/**
 * A calendar timeline's scrolling: it lands on today once, keeps the window on
 * its item when the past grows, grows the range at a resting edge, and tracks
 * whether today is in view for the way back to it.
 */
export function useTimelineScroll({
  virtualizer,
  keys,
  todayIndex,
  isLoading,
  isGrowing,
  grow,
  pastGrowEdge,
  futureGrowEdge,
  todayBuffer,
  deferVisibilityCheck = false,
}: TimelineScrollArgs) {
  // The virtualizer is one mutable instance, so compiled memoisation would keep its first items.
  "use no memo";

  const { captureAnchor, restoreAnchor } = usePrependAnchorRestore({ keys });
  const hasScrolledRef = useRef(false);
  const hasLandedRef = useRef(false);
  const hasGrownPastRef = useRef(false);
  const hasGrownFutureRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down");
  const count = keys.length;
  const { past: pastBuffer, future: futureBuffer } = todayBuffer;

  // Scroll to today after initial data loads
  useEffect(() => {
    if (hasScrolledRef.current || isLoading || todayIndex < 0) return;

    requestAnimationFrame(() => {
      landOnDay(virtualizer, todayIndex);
      hasScrolledRef.current = true;
    });
  }, [isLoading, todayIndex, virtualizer]);

  useEffect(() => {
    if (todayIndex < 0) return;

    const checkVisibility = () => {
      if (!hasScrolledRef.current) return;

      const items = virtualizer.getVirtualItems();
      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      if (!firstItem || !lastItem) return;

      const isTodayVisible =
        todayIndex >= firstItem.index + pastBuffer && todayIndex <= lastItem.index - futureBuffer;

      setShowScrollButton(!isTodayVisible);
      setScrollDirection(todayIndex < firstItem.index + pastBuffer ? "up" : "down");
    };

    if (!deferVisibilityCheck) {
      window.addEventListener("scroll", checkVisibility, { passive: true });
      checkVisibility();

      return () => window.removeEventListener("scroll", checkVisibility);
    }

    const handleScroll = () => requestAnimationFrame(checkVisibility);

    window.addEventListener("scroll", handleScroll, { passive: true });
    const timeoutId = setTimeout(checkVisibility, 100);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, [virtualizer, todayIndex, pastBuffer, futureBuffer, deferVisibilityCheck]);

  const virtualItems = virtualizer.getVirtualItems();

  useLayoutEffect(() => {
    restoreAnchor(
      () => virtualizer.getVirtualItems(),
      (offset) => {
        virtualizer.scrollToOffset(offset, { behavior: "auto" });
      }
    );
  }, [virtualizer, restoreAnchor]);

  // Grows once per approach to an edge, after the landing on today has arrived.
  useEffect(() => {
    if (virtualItems.length === 0 || !hasScrolledRef.current) return;
    if (!hasLandedRef.current) {
      if (!hasReachedDay(virtualItems, todayIndex)) return;
      hasLandedRef.current = true;
    }

    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];

    if (!firstItem || !lastItem) return;

    const isNearStart = firstItem.index <= pastGrowEdge;
    const isNearEnd = lastItem.index >= count - futureGrowEdge;

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
    pastGrowEdge,
    futureGrowEdge,
    isGrowing,
    grow,
    virtualizer,
    captureAnchor,
    todayIndex,
  ]);

  return {
    showScrollButton,
    scrollDirection,
    scrollToToday: () =>
      virtualizer.scrollToIndex(todayIndex, { align: "start", behavior: "smooth" }),
  };
}
