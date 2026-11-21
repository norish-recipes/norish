import type { VirtualItem, Virtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLandOnDay } from "@/components/calendar/land-on-day";
import { usePrependAnchorRestore } from "@/features/calendar/hooks/use-prepend-anchor-restore";

import type { GrowDirection } from "@norish/shared-react/calendar";

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
  grow: (direction: GrowDirection) => void;
  /** Items from the first (past) or last (future) within which a resting scroll grows that edge. */
  growEdge: Record<GrowDirection, number>;
  /** Items today must sit inside the window's first and last before it counts as visible. */
  todayBuffer: { past: number; future: number };
  /** Checks today's visibility a frame after each scroll and first after 100 ms. */
  deferVisibilityCheck?: boolean;
};

/**
 * Whether the window shows the landing's day yet; a day outside the range counts as shown.
 * Growing an edge before then widens the range under the top rows and pins the window there.
 */
export function hasReachedDay(items: readonly { index: number }[], index: number): boolean {
  return index < 0 || items.some((item) => item.index === index);
}

/**
 * Lands a timeline on today once, holds its place as the past grows, grows a resting edge,
 * and tracks whether today is in view for the way back to it.
 */
export function useTimelineScroll({
  virtualizer,
  keys,
  todayIndex,
  isLoading,
  isGrowing,
  grow,
  growEdge,
  todayBuffer,
  deferVisibilityCheck = false,
}: TimelineScrollArgs) {
  // The virtualizer is one mutable instance, so compiled memoisation would keep its first items.
  "use no memo";

  const { captureAnchor, restoreAnchor } = usePrependAnchorRestore({ keys });
  const hasReachedTodayRef = useRef(false);
  const hasGrownPastRef = useRef(false);
  const hasGrownFutureRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down");
  const count = keys.length;
  const { past: pastBuffer, future: futureBuffer } = todayBuffer;

  const landingAskedRef = useRef(false);

  useLandOnDay(virtualizer, todayIndex, isLoading, landingAskedRef);

  useEffect(() => {
    if (todayIndex < 0) return;

    const checkVisibility = () => {
      if (!landingAskedRef.current) return;

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
    if (virtualItems.length === 0 || !landingAskedRef.current) return;
    if (!hasReachedTodayRef.current) {
      if (!hasReachedDay(virtualItems, todayIndex)) return;
      hasReachedTodayRef.current = true;
    }

    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];

    if (!firstItem || !lastItem) return;

    const isNearStart = firstItem.index <= growEdge.past;
    const isNearEnd = lastItem.index >= count - growEdge.future;

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
    growEdge.past,
    growEdge.future,
    isGrowing,
    grow,
    virtualizer,
    captureAnchor,
    todayIndex,
  ]);

  const scrollToToday = useCallback(
    () => virtualizer.scrollToIndex(todayIndex, { align: "start", behavior: "smooth" }),
    [virtualizer, todayIndex]
  );

  return { showScrollButton, scrollDirection, scrollToToday };
}
