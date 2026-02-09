"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

import {
  useCalendarQuery,
  useCalendarMutations,
  useCalendarSubscription,
  type CalendarData,
} from "@/hooks/calendar";
import { Slot } from "@/types";
import { dateKey, addWeeks, getWeekStart, getWeekEnd } from "@/lib/helpers";

type PlannedItem = {
  id: string;
  userId: string;
  date: string;
  slot: Slot;
  sortOrder: number;
  itemType: "recipe" | "note";
  recipeId: string | null;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DateRange = {
  start: Date;
  end: Date;
};

type Ctx = {
  plannedItemsByDate: CalendarData;
  isLoading: boolean;
  isLoadingMore: boolean;
  dateRange: DateRange;
  planMeal: (date: string, slot: Slot, recipeId: string) => void;
  planNote: (date: string, slot: Slot, title: string) => void;
  deletePlanned: (id: string) => void;
  moveItem: (itemId: string, targetDate: string, targetSlot: Slot, targetIndex: number) => void;
  updateItem: (itemId: string, title: string) => void;
  getItemsForSlot: (date: string, slot: Slot) => PlannedItem[];
  expandRange: (direction: "past" | "future") => void;
  isDateInRange: (date: Date) => boolean;
};

const CalendarContext = createContext<Ctx | null>(null);

type CalendarContextProviderProps = {
  children: ReactNode;
  /** Initial range mode - desktop loads current week, mobile loads ±2 weeks */
  mode?: "desktop" | "mobile";
};

function getInitialDateRange(mode: "desktop" | "mobile"): DateRange {
  const now = new Date();

  if (mode === "desktop") {
    // Desktop: load current week only initially
    return {
      start: getWeekStart(now),
      end: getWeekEnd(now),
    };
  }

  // Mobile: load ±2 weeks from today
  return {
    start: getWeekStart(addWeeks(now, -2)),
    end: getWeekEnd(addWeeks(now, 2)),
  };
}

export function CalendarContextProvider({
  children,
  mode = "mobile",
}: CalendarContextProviderProps) {
  const [dateRange, setDateRange] = useState<DateRange>(() => getInitialDateRange(mode));
  const [isExpandingRange, setIsExpandingRange] = useState(false);

  const startISO = dateKey(dateRange.start);
  const endISO = dateKey(dateRange.end);

  const { calendarData, isLoading: isQueryLoading } = useCalendarQuery(startISO, endISO);
  const { createItem, deleteItem, moveItem, updateItem } = useCalendarMutations(startISO, endISO);

  // Track if initial load has completed (only show skeleton on first load)
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    if (!isQueryLoading && !hasLoadedOnceRef.current) {
      hasLoadedOnceRef.current = true;
    }
  }, [isQueryLoading]);

  // isInitialLoading is true only for the very first load
  const isInitialLoading = isQueryLoading && !hasLoadedOnceRef.current;

  useCalendarSubscription(startISO, endISO);

  const expandRange = useCallback(
    (direction: "past" | "future") => {
      if (isExpandingRange) return;

      setIsExpandingRange(true);

      setDateRange((prev) => {
        // Expand by 12 days (divisible by both 2 and 3 columns) to prevent grid shifting
        const daysToAdd = 12;

        if (direction === "past") {
          const newStart = new Date(prev.start);

          newStart.setDate(newStart.getDate() - daysToAdd);

          return {
            start: newStart,
            end: prev.end,
          };
        }
        const newEnd = new Date(prev.end);

        newEnd.setDate(newEnd.getDate() + daysToAdd);

        return {
          start: prev.start,
          end: newEnd,
        };
      });

      // Reset expanding state after a short delay to allow new query to start
      setTimeout(() => setIsExpandingRange(false), 100);
    },
    [isExpandingRange]
  );

  const isDateInRange = useCallback(
    (date: Date): boolean => {
      const d = new Date(date);

      return d >= dateRange.start && d <= dateRange.end;
    },
    [dateRange]
  );

  const planMeal = useCallback(
    (date: string, slot: Slot, recipeId: string): void => {
      createItem(date, slot, "recipe", recipeId, undefined);
    },
    [createItem]
  );

  const planNote = useCallback(
    (date: string, slot: Slot, title: string): void => {
      createItem(date, slot, "note", undefined, title);
    },
    [createItem]
  );

  const deletePlanned = useCallback(
    (id: string): void => {
      deleteItem(id);
    },
    [deleteItem]
  );

  const getItemsForSlot = useCallback(
    (date: string, slot: Slot): PlannedItem[] => {
      const items = calendarData[date] ?? [];

      return items.filter((item) => item.slot === slot).sort((a, b) => a.sortOrder - b.sortOrder);
    },
    [calendarData]
  );

  const value = useMemo<Ctx>(
    () => ({
      plannedItemsByDate: calendarData,
      isLoading: isInitialLoading,
      isLoadingMore: isExpandingRange,
      dateRange,
      planMeal,
      planNote,
      deletePlanned,
      moveItem,
      updateItem,
      getItemsForSlot,
      expandRange,
      isDateInRange,
    }),
    [
      calendarData,
      isInitialLoading,
      isExpandingRange,
      dateRange,
      planMeal,
      planNote,
      deletePlanned,
      moveItem,
      updateItem,
      getItemsForSlot,
      expandRange,
      isDateInRange,
    ]
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendarContext() {
  const ctx = useContext(CalendarContext);

  if (!ctx) throw new Error("useCalendarContext must be used within CalendarContextProvider");

  return ctx;
}
