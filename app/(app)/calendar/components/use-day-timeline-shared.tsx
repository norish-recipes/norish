"use client";

import type { PanInfo } from "motion/react";
import type { CaldavItemType } from "@/types";

import { useMemo, useState, useCallback } from "react";

import { useCalendarContext } from "../context";

import { CalendarDayDropZone } from "./calendar-day-drop-zone";

import { startOfMonth, addMonths, endOfMonth, eachDayOfInterval, dateKey } from "@/lib/helpers";
import { DayTimelineBody } from "@/app/(app)/calendar/components/day-timeline-body";
import { DayTimelineHeader } from "@/app/(app)/calendar/components/day-timeline-header";
import DayTimelineSkeleton from "@/components/skeleton/day-timeline-skeleton";

const SLOT_ORDER: Record<string, number> = { Breakfast: 0, Lunch: 1, Dinner: 2, Snack: 3 };

export function useDayTimelineShared() {
  const today = useMemo(() => new Date(), []);
  const { plannedItemsByDate, isLoading, deletePlanned, updateItemDate } = useCalendarContext();

  const [todayVisible, setTodayVisible] = useState(true);
  const [arrowDir, setArrowDir] = useState<"up" | "down">("up");
  const [_togglePanelOpen, setTogglePanelOpen] = useState(false);

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemDate, setDraggedItemDate] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<CaldavItemType | null>(null);

  const rangeStart = useMemo(() => startOfMonth(addMonths(today, -1)), [today]);
  const rangeEnd = useMemo(() => endOfMonth(addMonths(today, 1)), [today]);
  const allDays = useMemo(() => eachDayOfInterval(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const weekdayLong = useMemo(() => new Intl.DateTimeFormat(undefined, { weekday: "long" }), []);
  const monthLong = useMemo(() => new Intl.DateTimeFormat(undefined, { month: "long" }), []);

  const todayKey = useMemo(() => dateKey(today), [today]);
  const todayIndex = useMemo(
    () => allDays.findIndex((d) => dateKey(d) === todayKey),
    [allDays, todayKey]
  );

  const handleDragStart = useCallback(
    (itemId: string, currentDate: string) => {
      const items = plannedItemsByDate[currentDate] ?? [];
      const item = items.find((i) => i.id === itemId);

      if (item) {
        setDraggedItemId(itemId);
        setDraggedItemDate(currentDate);
        setDraggedItemType(item.itemType);
      }
    },
    [plannedItemsByDate]
  );

  const handleDragEnd = useCallback((_itemId: string, _currentDate: string, _info: PanInfo) => {
    setTimeout(() => {
      setDraggedItemId(null);
      setDraggedItemDate(null);
      setDraggedItemType(null);
    }, 100);
  }, []);

  const handleDrop = useCallback(
    (targetDate: string) => {
      if (draggedItemId && draggedItemDate && draggedItemType && draggedItemDate !== targetDate) {
        updateItemDate(draggedItemId, draggedItemDate, targetDate, draggedItemType);
      }
    },
    [draggedItemId, draggedItemDate, draggedItemType, updateItemDate]
  );

  const renderDayContent = useCallback(
    (d: Date) => {
      const items = (plannedItemsByDate[dateKey(d)] ?? []).sort(
        (a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]
      );
      const isToday =
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();

      return (
        <CalendarDayDropZone
          key={dateKey(d)}
          date={dateKey(d)}
          draggedItemDate={draggedItemDate}
          isDraggingItem={draggedItemId !== null}
          onDrop={handleDrop}
        >
          <div className="divide-default-200 divide-y" data-day-key={dateKey(d)}>
            <div className="md:bg-content1 flex flex-col gap-2 px-3 py-3">
              <DayTimelineHeader
                date={d}
                isToday={isToday}
                month={monthLong.format(d)}
                weekday={weekdayLong.format(d)}
                onPanelOpenChange={(open) => setTogglePanelOpen(open)}
              />
              <div className="bg-default-200 h-px" />
              <DayTimelineBody
                isDraggingAny={draggedItemId !== null}
                items={items}
                onDelete={(id, itemType) => deletePlanned(id, dateKey(d), itemType)}
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
              />
            </div>
          </div>
        </CalendarDayDropZone>
      );
    },
    [
      plannedItemsByDate,
      today,
      handleDrop,
      draggedItemId,
      draggedItemDate,
      weekdayLong,
      monthLong,
      deletePlanned,
      handleDragStart,
      handleDragEnd,
    ]
  );

  const EmptyState = () => (
    <div className="flex h-full flex-col items-center justify-center">
      <p className="text-default-500">No days available.</p>
    </div>
  );

  const LoadingSkeleton = () => <DayTimelineSkeleton />;

  return {
    allDays,
    todayIndex,
    todayVisible,
    setTodayVisible,
    arrowDir,
    setArrowDir,
    renderDayContent,
    isLoading,
    EmptyState,
    LoadingSkeleton,
  };
}
