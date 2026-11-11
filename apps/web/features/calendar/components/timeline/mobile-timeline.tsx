"use client";

import type { PlannedItemDisplay } from "@/components/calendar/types";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { landOnDay, settleLanding } from "@/components/calendar/land-on-day";
import { PlannedItemContent } from "@/components/calendar/planned-item-content";
import { TimelineDaySection } from "@/components/calendar/timeline-day-section";
import { SLOT_ORDER } from "@/components/calendar/types";
import { useReaderToday } from "@/components/reader-today";
import { CalendarSkeletonMobile } from "@/features/calendar/components/skeleton/calendar-skeleton";
import { useCalendarDnd } from "@/features/calendar/hooks/use-calendar-dnd";
import { useGrowAtEdges } from "@/features/calendar/hooks/use-grow-at-edges";
import { usePrependAnchorRestore } from "@/features/calendar/hooks/use-prepend-anchor-restore";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLocale } from "next-intl";
import { useWindowSize } from "usehooks-ts";

import type { Slot } from "@norish/shared/contracts";
import { useCalendarRangeQuery } from "@norish/shared-react/calendar";
import { dateKey, eachDayOfInterval, parseDateKey } from "@norish/shared/lib/helpers";

import { TimelineScrollToToday } from "./timeline-scroll-to-today";

const mobileDragActivationDelayMs = 300;
const mobileDragTolerancePx = 10;

// An empty day, which most days are
const ESTIMATED_DAY_HEIGHT = 64;

type MobileTimelineProps = {
  onAddItem: (dateKey: string, slot: Slot) => void;
  onNoteClick?: (item: PlannedItemDisplay) => void;
  onRecipeClick?: (item: PlannedItemDisplay) => void;
};

export function MobileTimeline({ onAddItem, onNoteClick, onRecipeClick }: MobileTimelineProps) {
  // TanStack Virtual hands back one mutable instance, so compiled memoisation
  // would keep its first rows.
  "use no memo";

  const locale = useLocale();

  const { range, isGrowing, grow, calendarData, isLoading } = useCalendarRangeQuery();

  const allDays = useMemo(
    () => eachDayOfInterval(parseDateKey(range.startISO), parseDateKey(range.endISO)),
    [range.startISO, range.endISO]
  );
  const dayKeys = useMemo(() => allDays.map((d) => dateKey(d)), [allDays]);
  const { captureAnchor, restoreAnchor } = usePrependAnchorRestore({ keys: dayKeys });

  // A day's date on one line: "Wed, Oct 7"
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }),
    [locale]
  );

  // Today tracking
  const todayKey = useReaderToday();
  const today = useMemo(() => parseDateKey(todayKey), [todayKey]);
  const todayIndex = useMemo(
    () => allDays.findIndex((d) => dateKey(d) === todayKey),
    [allDays, todayKey]
  );

  // Container ref for scroll margin calculation
  const containerRef = useRef<HTMLDivElement>(null);

  // Track viewport changes to recalculate scroll margin
  const { height: windowHeight } = useWindowSize();

  // Calculate scroll margin from container position
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    if (windowHeight <= 0 || typeof window === "undefined" || !containerRef.current) {
      setScrollMargin(0);

      return;
    }

    const rect = containerRef.current.getBoundingClientRect();

    setScrollMargin(rect.top + window.scrollY);
  }, [windowHeight]);

  // Window virtualizer (like recipe grid)
  const virtualizer = useWindowVirtualizer({
    count: allDays.length,
    getItemKey: (index) => dayKeys[index] ?? index,
    estimateSize: () => ESTIMATED_DAY_HEIGHT,
    overscan: 5,
    scrollMargin,
    // Today lands where the first day sits with the page at its top: below the
    // status bar's fade rather than under it.
    scrollPaddingStart: scrollMargin,
    onChange: settleLanding,
  });

  // Track if we've scrolled to today
  const hasScrolledRef = useRef(false);

  // Scroll to today after initial data loads
  useEffect(() => {
    if (hasScrolledRef.current || isLoading || todayIndex < 0) return;

    requestAnimationFrame(() => {
      landOnDay(virtualizer, todayIndex);
      hasScrolledRef.current = true;
    });
  }, [isLoading, todayIndex, virtualizer]);

  // Scroll-to-today button state - simple date comparison approach
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down");

  // Check if today is visible by looking at which dates are currently rendered
  useEffect(() => {
    if (todayIndex < 0) return;

    const checkVisibility = () => {
      // Don't show until initial scroll is complete
      if (!hasScrolledRef.current) return;

      const items = virtualizer.getVirtualItems();

      if (items.length === 0) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      if (!firstItem || !lastItem) return;

      const firstIndex = firstItem.index;
      const lastIndex = lastItem.index;

      // Use asymmetric buffer: larger for future (scrolling down), smaller for past (scrolling up)
      const pastBuffer = 2;
      const futureBuffer = 5;

      const isTodayVisible =
        todayIndex >= firstIndex + pastBuffer && todayIndex <= lastIndex - futureBuffer;

      setShowScrollButton(!isTodayVisible);

      // Direction: if today is before current view, go up; otherwise go down
      setScrollDirection(todayIndex < firstIndex + pastBuffer ? "up" : "down");
    };

    // Check on scroll
    const handleScroll = () => {
      requestAnimationFrame(checkVisibility);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Initial check after a short delay to ensure virtualizer is ready
    const timeoutId = setTimeout(checkVisibility, 100);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, [virtualizer, todayIndex]);

  const virtualItems = virtualizer.getVirtualItems();

  useLayoutEffect(() => {
    restoreAnchor(
      () => virtualizer.getVirtualItems(),
      (offset) => {
        virtualizer.scrollToOffset(offset, { behavior: "auto" });
      }
    );
  }, [virtualizer, restoreAnchor]);

  // Infinite scroll: grow the range when a scroll rests near an edge
  useGrowAtEdges({
    virtualizer,
    virtualItems,
    count: allDays.length,
    todayIndex: todayIndex,
    startEdge: 2,
    hasScrolledRef,
    captureAnchor,
    isGrowing,
    grow,
  });

  const handleScrollToToday = useCallback(() => {
    virtualizer.scrollToIndex(todayIndex, { align: "start", behavior: "smooth" });
  }, [virtualizer, todayIndex]);

  // Drag and drop
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: mobileDragActivationDelayMs,
      tolerance: mobileDragTolerancePx,
    },
  });

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      delay: mobileDragActivationDelayMs,
      tolerance: mobileDragTolerancePx,
    },
  });

  const dndId = useId();
  const sensors = useSensors(touchSensor, pointerSensor);
  const { activeItem, dragOverDateKey, dndContextProps } = useCalendarDnd(calendarData);

  // Also before the window is measured, which the server and the hydrating render never are: with
  // a seeded range the days draw on the first measured frame, without a request.
  if (isLoading || virtualItems.length === 0) {
    return <CalendarSkeletonMobile />;
  }

  return (
    <div className="fade-in">
      <DndContext {...dndContextProps} id={dndId} sensors={sensors}>
        <div
          ref={containerRef}
          className="relative overflow-visible"
          style={{ containIntrinsicSize: "0 500px" }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
              overflow: "visible",
            }}
          >
            {virtualItems.map((virtualItem) => {
              const d = allDays[virtualItem.index];

              if (!d) {
                return null;
              }

              const key = dateKey(d);
              const items = (calendarData[key] ?? [])
                .sort((a, b) => (SLOT_ORDER[a.slot] ?? 0) - (SLOT_ORDER[b.slot] ?? 0))
                .map((it) => it as PlannedItemDisplay);
              const isToday = key === todayKey;

              return (
                <div
                  key={virtualItem.key}
                  ref={virtualizer.measureElement}
                  data-day-key={key}
                  data-index={virtualItem.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    padding: "4px 0",
                    overflow: "visible",
                    transform: `translateY(${virtualItem.start - scrollMargin}px)`,
                  }}
                >
                  <TimelineDaySection
                    date={d}
                    dateFormatter={dateFormatter}
                    dateKey={key}
                    isDragOver={dragOverDateKey === key}
                    isToday={isToday}
                    items={items}
                    onAddItem={onAddItem}
                    onNoteClick={onNoteClick}
                    onRecipeClick={onRecipeClick}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <TimelineScrollToToday
          direction={scrollDirection}
          isVisible={showScrollButton}
          onClick={handleScrollToToday}
        />

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <PlannedItemContent
              className="bg-surface ring-accent/30 w-[calc(100vw-48px)] rounded-xl px-3 py-2.5 shadow-xl ring-2"
              item={activeItem}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
