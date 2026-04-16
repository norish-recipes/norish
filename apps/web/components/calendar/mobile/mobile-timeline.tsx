"use client";

import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import { CalendarSkeletonMobile } from "@/components/skeleton/calendar-skeleton";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLocale } from "next-intl";
import { useWindowSize } from "usehooks-ts";

import type { Slot } from "@norish/shared/contracts";
import { dateKey, eachDayOfInterval } from "@norish/shared/lib/helpers";

import type { PlannedItemDisplay } from "./types";
import { usePrependAnchorRestore } from "../use-prepend-anchor-restore";
import { TimelineDaySection } from "./timeline-day-section";
import { TimelineDragOverlay } from "./timeline-drag-overlay";
import { TimelineScrollToToday } from "./timeline-scroll-to-today";
import { SLOT_ORDER } from "./types";

const mobileDragActivationDelayMs = 300;
const mobileDragTolerancePx = 10;

function startOfDay(date: Date): Date {
  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  return d;
}

const ESTIMATED_DAY_HEIGHT = 120;

type MobileTimelineProps = {
  onAddItem: (dateKey: string, slot: Slot) => void;
  onNoteClick?: (item: PlannedItemDisplay) => void;
  onRecipeClick?: (item: PlannedItemDisplay) => void;
};

export function MobileTimeline({ onAddItem, onNoteClick, onRecipeClick }: MobileTimelineProps) {
  const locale = useLocale();

  // Use calendar context (like recipe grid uses recipes context)
  const {
    plannedItemsByDate: calendarData,
    isLoading,
    isLoadingMore,
    dateRange,
    expandRange,
    moveItem,
  } = useCalendarContext();

  // Generate all days in range from context
  const allDays = useMemo(
    () => eachDayOfInterval(dateRange.start, dateRange.end),
    [dateRange.start, dateRange.end]
  );
  const dayKeys = useMemo(() => allDays.map((d) => dateKey(d)), [allDays]);
  const { captureAnchor, restoreAnchor, shouldAdjustScrollForSizeChange } = usePrependAnchorRestore(
    { keys: dayKeys }
  );

  // Date formatters
  const weekdayFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long" }),
    [locale]
  );
  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long" }),
    [locale]
  );

  // Today tracking
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = useMemo(() => dateKey(today), [today]);
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
    shouldAdjustScrollPositionOnItemSizeChange: (item, _delta, instance) => {
      const scrollOffset = instance.scrollOffset ?? 0;

      return shouldAdjustScrollForSizeChange(item.start, scrollOffset, scrollMargin);
    },
  });

  // Track if we've scrolled to today and if we've triggered expand
  const hasScrolledRef = useRef(false);
  const hasTriggeredExpandPastRef = useRef(false);
  const hasTriggeredExpandFutureRef = useRef(false);

  // Scroll to today after initial data loads
  useEffect(() => {
    if (hasScrolledRef.current || isLoading || todayIndex < 0) return;

    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(todayIndex, { align: "start" });
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

  // Infinite scroll: trigger expandRange when near the edges
  useEffect(() => {
    if (virtualItems.length === 0 || !hasScrolledRef.current) return;

    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];

    if (!firstItem || !lastItem) return;

    const isNearStart = firstItem.index <= 2;
    const isNearEnd = lastItem.index >= allDays.length - 2;

    if (isNearStart && !isLoadingMore && !hasTriggeredExpandPastRef.current) {
      const scrollOffset = virtualizer.scrollOffset ?? 0;

      captureAnchor({
        index: firstItem.index,
        itemStart: firstItem.start,
        scrollOffset,
      });

      hasTriggeredExpandPastRef.current = true;
      expandRange("past");
    }
    if (!isNearStart) {
      hasTriggeredExpandPastRef.current = false;
    }

    if (isNearEnd && !isLoadingMore && !hasTriggeredExpandFutureRef.current) {
      hasTriggeredExpandFutureRef.current = true;
      expandRange("future");
    }
    if (!isNearEnd) {
      hasTriggeredExpandFutureRef.current = false;
    }
  }, [virtualItems, allDays.length, isLoadingMore, expandRange, virtualizer, captureAnchor]);

  const handleScrollToToday = useCallback(() => {
    virtualizer.scrollToIndex(todayIndex, { align: "start", behavior: "smooth" });
  }, [virtualizer, todayIndex]);

  // Drag and drop
  const [activeItem, setActiveItem] = useState<PlannedItemDisplay | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);

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

  const sensors = useSensors(touchSensor, pointerSensor);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const itemId = active.id as string;

      for (const dayItems of Object.values(calendarData)) {
        const item = dayItems.find((i) => i.id === itemId);

        if (item) {
          setActiveItem(item as PlannedItemDisplay);
          break;
        }
      }
    },
    [calendarData]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { over } = event;
      const draggedItem = activeItem;

      setActiveItem(null);
      setDragOverDateKey(null);

      if (!over || !draggedItem) return;

      const overId = over.id as string;

      // Only accept drops on day containers (format: "dateKey_drop")
      if (!overId.endsWith("_drop")) return;

      const targetDate = overId.replace("_drop", "");

      // Skip if same day
      if (draggedItem.date === targetDate) return;

      // Keep the same slot - only change the day
      const targetSlot = draggedItem.slot;

      // Calculate target index (append to end of slot on target day)
      const targetSlotItems = (calendarData[targetDate] ?? []).filter(
        (i) => i.slot === targetSlot && i.id !== draggedItem.id
      );
      const targetIndex = targetSlotItems.length;

      moveItem(draggedItem.id, targetDate, targetSlot, targetIndex);
    },
    [activeItem, calendarData, moveItem]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;

      if (!over || !activeItem) {
        setDragOverDateKey(null);

        return;
      }

      const overId = over.id as string;

      // Only highlight day containers
      if (!overId.endsWith("_drop")) {
        setDragOverDateKey(null);

        return;
      }

      const targetDate = overId.replace("_drop", "");

      // Only highlight if dragging to a different day
      if (targetDate !== activeItem.date) {
        setDragOverDateKey(targetDate);
      } else {
        setDragOverDateKey(null);
      }
    },
    [activeItem]
  );

  if (isLoading) {
    return <CalendarSkeletonMobile />;
  }

  const collisionDetection = (args: Parameters<typeof pointerWithin>[0]) => {
    const pointerCollisions = pointerWithin(args);

    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    return rectIntersection(args);
  };

  return (
    <div className="fade-in">
      <DndContext
        collisionDetection={collisionDetection}
        sensors={sensors}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
      >
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
                    padding: "4px 8px",
                    overflow: "visible",
                    transform: `translateY(${virtualItem.start - scrollMargin}px)`,
                  }}
                >
                  <TimelineDaySection
                    date={d}
                    dateKey={key}
                    isDragOver={dragOverDateKey === key}
                    isToday={isToday}
                    items={items}
                    monthFormatter={monthFormatter}
                    weekdayFormatter={weekdayFormatter}
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
          {activeItem ? <TimelineDragOverlay item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
