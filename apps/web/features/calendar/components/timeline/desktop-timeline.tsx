"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { settleLanding } from "@/components/calendar/land-on-day";
import { PlannedItemContent } from "@/components/calendar/planned-item-content";
import { useReaderToday } from "@/components/reader-today";
import { CalendarSkeletonDesktop } from "@/features/calendar/components/skeleton/calendar-skeleton";
import { useCalendarDnd } from "@/features/calendar/hooks/use-calendar-dnd";
import { useTimelineScroll } from "@/features/calendar/hooks/use-timeline-scroll";
import { useViewport } from "@/hooks/use-viewport";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useLocale } from "next-intl";
import { useWindowSize } from "usehooks-ts";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import { useCalendarRangeQuery } from "@norish/shared-react/calendar";
import { dateKey, eachDayOfInterval, parseDateKey } from "@norish/shared/lib/helpers";

import { DesktopDayCard } from "./desktop-day-card";
import { DesktopScrollToToday } from "./desktop-scroll-to-today";

const ESTIMATED_ROW_HEIGHT = 420; // Card height (400) + gap (20)
// One array for every empty day, so its memoised card skips the re-render.
const NO_ITEMS: PlannedItemFromQuery[] = [];

type DesktopTimelineProps = {
  onAddItem: (dateKey: string, slot: Slot) => void;
  onNoteClick?: (item: PlannedItemFromQuery) => void;
  onRecipeClick?: (item: PlannedItemFromQuery) => void;
};

export function DesktopTimeline({ onAddItem, onNoteClick, onRecipeClick }: DesktopTimelineProps) {
  // TanStack Virtual hands back one mutable instance, so compiled memoisation
  // would keep its first rows.
  "use no memo";

  const locale = useLocale();

  const { range, isGrowing, grow, calendarData, isLoading } = useCalendarRangeQuery();

  // Responsive column count: 3 for lg+, 2 for md
  const columnCount = useViewport((width) => (width >= 1024 ? 3 : 2));
  const { height: windowHeight } = useWindowSize();

  // Every day in the range, padded to fill complete rows
  const allDays = useMemo(() => {
    const days = eachDayOfInterval(parseDateKey(range.startISO), parseDateKey(range.endISO));
    // Pad to complete rows to prevent grid shifting
    const remainder = days.length % columnCount;

    if (remainder !== 0) {
      const lastDay = days[days.length - 1];
      const padding = columnCount - remainder;

      if (!lastDay) {
        return days;
      }

      for (let i = 1; i <= padding; i++) {
        const nextDay = new Date(lastDay);

        nextDay.setDate(lastDay.getDate() + i);
        days.push(nextDay);
      }
    }

    return days;
  }, [range.startISO, range.endISO, columnCount]);

  // Group days into rows based on column count
  const rows = useMemo(() => {
    const result: Date[][] = [];

    for (let i = 0; i < allDays.length; i += columnCount) {
      result.push(allDays.slice(i, i + columnCount));
    }

    return result;
  }, [allDays, columnCount]);
  const rowKeys = useMemo(
    () => rows.map((row, index) => (row[0] ? dateKey(row[0]) : `row-${index}`)),
    [rows]
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
  const todayKey = useReaderToday();
  const todayRowIndex = useMemo(() => {
    const dayIndex = allDays.findIndex((d) => dateKey(d) === todayKey);

    return dayIndex >= 0 ? Math.floor(dayIndex / columnCount) : -1;
  }, [allDays, todayKey, columnCount]);

  // Container ref for scroll margin calculation
  const containerRef = useRef<HTMLDivElement>(null);

  // The container's offset is measured on a resize, the one thing that moves it;
  // until then the timeline counts from the top of the page.
  const [scrollMargin, setScrollMargin] = useState(0);
  const measuredHeightRef = useRef(windowHeight);

  useLayoutEffect(() => {
    if (windowHeight === measuredHeightRef.current) return;
    measuredHeightRef.current = windowHeight;
    setScrollMargin(
      containerRef.current ? containerRef.current.getBoundingClientRect().top + window.scrollY : 0
    );
  }, [windowHeight]);

  // Window virtualizer (like mobile/recipe grid)
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    getItemKey: (index) => rowKeys[index] ?? index,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 2,
    scrollMargin,
    onChange: settleLanding,
  });

  const { showScrollButton, scrollDirection, scrollToToday } = useTimelineScroll({
    virtualizer,
    keys: rowKeys,
    todayIndex: todayRowIndex,
    isLoading,
    isGrowing,
    grow,
    growEdge: { past: 1, future: 2 },
    todayBuffer: { past: 1, future: 1 },
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Drag and drop
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });

  const dndId = useId();
  const sensors = useSensors(pointerSensor);
  const { activeItem, dragOverDateKey, dndContextProps } = useCalendarDnd(calendarData);

  // Also before the window is measured, which the server and the hydrating render never are: with
  // a seeded range the days draw on the first measured frame, without a request.
  if (isLoading || virtualItems.length === 0) {
    return <CalendarSkeletonDesktop />;
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
            {virtualItems.map((virtualRow) => {
              const rowDays = rows[virtualRow.index];

              if (!rowDays) {
                return null;
              }

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
                      const items = calendarData[key] ?? NO_ITEMS;
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
          onClick={scrollToToday}
        />

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <PlannedItemContent
              className="bg-surface ring-accent/30 w-80 rounded-xl px-3 py-2.5 shadow-xl ring-2"
              item={activeItem}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
