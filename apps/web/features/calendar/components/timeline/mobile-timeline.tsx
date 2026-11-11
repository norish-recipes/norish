"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { settleLanding } from "@/components/calendar/land-on-day";
import { PlannedItemContent } from "@/components/calendar/planned-item-content";
import { TimelineDaySection } from "@/components/calendar/timeline-day-section";
import { useReaderToday } from "@/components/reader-today";
import { CalendarSkeletonMobile } from "@/features/calendar/components/skeleton/calendar-skeleton";
import { useCalendarDnd } from "@/features/calendar/hooks/use-calendar-dnd";
import { useTimelineScroll } from "@/features/calendar/hooks/use-timeline-scroll";
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

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import { useCalendarRangeQuery } from "@norish/shared-react/calendar";
import { dateKey, eachDayOfInterval, parseDateKey } from "@norish/shared/lib/helpers";

import { TimelineScrollToToday } from "./timeline-scroll-to-today";

const mobileDragActivationDelayMs = 300;
const mobileDragTolerancePx = 10;

// An empty day, which most days are
const ESTIMATED_DAY_HEIGHT = 64;
// One array for every empty day, so its memoised card skips the re-render.
const NO_ITEMS: PlannedItemFromQuery[] = [];

type MobileTimelineProps = {
  onAddItem: (dateKey: string, slot: Slot) => void;
  onNoteClick?: (item: PlannedItemFromQuery) => void;
  onRecipeClick?: (item: PlannedItemFromQuery) => void;
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

  // A day's date on one line: "Wed, Oct 7"
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }),
    [locale]
  );

  // Today tracking
  const todayKey = useReaderToday();
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
    if (windowHeight <= 0 || !containerRef.current) {
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

  const { showScrollButton, scrollDirection, scrollToToday } = useTimelineScroll({
    virtualizer,
    keys: dayKeys,
    todayIndex: todayIndex,
    isLoading,
    isGrowing,
    grow,
    pastGrowEdge: 2,
    futureGrowEdge: 2,
    todayBuffer: { past: 2, future: 5 },
    deferVisibilityCheck: true,
  });

  const virtualItems = virtualizer.getVirtualItems();

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
              const items = calendarData[key] ?? NO_ITEMS;
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
          onClick={scrollToToday}
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
