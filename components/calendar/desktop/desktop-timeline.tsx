"use client";

import type { Slot } from "@/types";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core";
import type { PlannedItemDisplay } from "@/components/calendar/mobile/types";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
} from "@dnd-kit/core";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowSize } from "usehooks-ts";

import { DesktopScrollToToday } from "./desktop-scroll-to-today";
import { DesktopDayCard } from "./desktop-day-card";
import { DesktopDragOverlay } from "./desktop-drag-overlay";

import { CalendarSkeletonDesktop } from "@/components/skeleton/calendar-skeleton";
import { useCalendarContext } from "@/app/(app)/calendar/context";
import { dateKey, eachDayOfInterval } from "@/lib/helpers";
import { SLOT_ORDER } from "@/components/calendar/mobile/types";

function startOfDay(date: Date): Date {
  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  return d;
}

const ESTIMATED_ROW_HEIGHT = 420; // Card height (400) + gap (20)

type DesktopTimelineProps = {
  onAddItem: (dateKey: string, slot: Slot) => void;
  onNoteClick?: (item: PlannedItemDisplay) => void;
  onRecipeClick?: (item: PlannedItemDisplay) => void;
};

export function DesktopTimeline({ onAddItem, onNoteClick, onRecipeClick }: DesktopTimelineProps) {
  const locale = useLocale();
  const tSlots = useTranslations("common.slots");

  // Use calendar context
  const {
    plannedItemsByDate: calendarData,
    isLoading,
    isLoadingMore,
    dateRange,
    expandRange,
    moveItem,
  } = useCalendarContext();

  // Responsive column count: 3 for lg+, 2 for md
  const { width = 1024, height: _windowHeight } = useWindowSize();
  const columnCount = width >= 1024 ? 3 : 2;

  // Generate all days in range from context, padded to fill complete rows
  const allDays = useMemo(() => {
    const days = eachDayOfInterval(dateRange.start, dateRange.end);
    // Pad to complete rows to prevent grid shifting
    const remainder = days.length % columnCount;

    if (remainder !== 0) {
      const lastDay = days[days.length - 1];
      const padding = columnCount - remainder;

      for (let i = 1; i <= padding; i++) {
        const nextDay = new Date(lastDay);

        nextDay.setDate(lastDay.getDate() + i);
        days.push(nextDay);
      }
    }

    return days;
  }, [dateRange.start, dateRange.end, columnCount]);

  // Group days into rows based on column count
  const rows = useMemo(() => {
    const result: Date[][] = [];

    for (let i = 0; i < allDays.length; i += columnCount) {
      result.push(allDays.slice(i, i + columnCount));
    }

    return result;
  }, [allDays, columnCount]);

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
  const todayRowIndex = useMemo(() => {
    const dayIndex = allDays.findIndex((d) => dateKey(d) === todayKey);

    return dayIndex >= 0 ? Math.floor(dayIndex / columnCount) : -1;
  }, [allDays, todayKey, columnCount]);

  // Container ref for scroll margin calculation
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate scroll margin from container position
  const scrollMargin = useMemo(() => {
    if (typeof window === "undefined" || !containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();

    return rect.top + window.scrollY;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_windowHeight]);

  // Window virtualizer (like mobile/recipe grid)
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 2,
    scrollMargin,
  });

  // Track if we've scrolled to today and if we've triggered expand
  const hasScrolledRef = useRef(false);
  const hasTriggeredExpandPastRef = useRef(false);
  const hasTriggeredExpandFutureRef = useRef(false);

  // Scroll to today after initial data loads
  useEffect(() => {
    if (hasScrolledRef.current || isLoading || todayRowIndex < 0) return;

    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(todayRowIndex, { align: "start" });
      hasScrolledRef.current = true;
    });
  }, [isLoading, todayRowIndex, virtualizer]);

  // Scroll-to-today button state
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("down");

  // Check if today is visible
  useEffect(() => {
    if (todayRowIndex < 0) return;

    const checkVisibility = () => {
      if (!hasScrolledRef.current) return;

      const items = virtualizer.getVirtualItems();

      if (items.length === 0) return;

      const firstIndex = items[0].index;
      const lastIndex = items[items.length - 1].index;

      // Use tighter bounds - show FAB sooner when scrolling away from today
      const buffer = 1;
      const isTodayVisible =
        todayRowIndex >= firstIndex + buffer && todayRowIndex <= lastIndex - buffer;

      setShowScrollButton(!isTodayVisible);
      setScrollDirection(todayRowIndex < firstIndex + buffer ? "up" : "down");
    };

    window.addEventListener("scroll", checkVisibility, { passive: true });
    checkVisibility();

    return () => {
      window.removeEventListener("scroll", checkVisibility);
    };
  }, [virtualizer, todayRowIndex]);

  const virtualItems = virtualizer.getVirtualItems();

  // Infinite scroll: trigger expandRange when near the edges
  useEffect(() => {
    if (virtualItems.length === 0 || !hasScrolledRef.current) return;

    const firstItem = virtualItems[0];
    const lastItem = virtualItems[virtualItems.length - 1];

    if (!firstItem || !lastItem) return;

    const isNearStart = firstItem.index <= 1;
    const isNearEnd = lastItem.index >= rows.length - 2;

    if (isNearStart && !isLoadingMore && !hasTriggeredExpandPastRef.current) {
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
  }, [virtualItems, rows.length, isLoadingMore, expandRange]);

  const handleScrollToToday = useCallback(() => {
    virtualizer.scrollToIndex(todayRowIndex, { align: "start", behavior: "smooth" });
  }, [virtualizer, todayRowIndex]);

  // Drag and drop
  const [activeItem, setActiveItem] = useState<PlannedItemDisplay | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const sensors = useSensors(pointerSensor);

  const _slotLabels: Record<Slot, string> = useMemo(
    () => ({
      Breakfast: tSlots("breakfast"),
      Lunch: tSlots("lunch"),
      Dinner: tSlots("dinner"),
      Snack: tSlots("snack"),
    }),
    [tSlots]
  );

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
    return <CalendarSkeletonDesktop />;
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
            {virtualItems.map((virtualRow) => {
              const rowDays = rows[virtualRow.index];

              return (
                <div
                  key={virtualRow.key}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full px-4 py-2"
                  data-index={virtualRow.index}
                  style={{
                    transform: `translateY(${virtualRow.start - scrollMargin}px)`,
                  }}
                >
                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                    }}
                  >
                    {rowDays.map((d) => {
                      const key = dateKey(d);
                      const items = (calendarData[key] ?? [])
                        .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot])
                        .map((it) => it as PlannedItemDisplay);
                      const isToday = key === todayKey;

                      return (
                        <DesktopDayCard
                          key={key}
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
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DesktopScrollToToday
          direction={scrollDirection}
          isVisible={showScrollButton}
          onClick={handleScrollToToday}
        />

        <DragOverlay dropAnimation={null}>
          {activeItem ? <DesktopDragOverlay item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
