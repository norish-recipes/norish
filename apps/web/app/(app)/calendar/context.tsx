"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useCalendarMutations, useCalendarQuery, useCalendarSubscription } from "@/hooks/calendar";

import type { PlannedItemFromQuery, Slot } from "@norish/shared/contracts";
import { dateKey } from "@norish/shared/lib/helpers";

import type {
  CalendarContextProviderProps,
  CalendarContextValue,
  CalendarDateRange,
} from "./context-types";
import { getInitialDateRange } from "./context-helpers";

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarContextProvider({
  children,
  mode = "mobile",
}: CalendarContextProviderProps) {
  const [dateRange, setDateRange] = useState<CalendarDateRange>(() => getInitialDateRange(mode));
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
    (date: string, slot: Slot): PlannedItemFromQuery[] => {
      const items = calendarData[date] ?? [];

      return items.filter((item) => item.slot === slot).sort((a, b) => a.sortOrder - b.sortOrder);
    },
    [calendarData]
  );

  const value = useMemo<CalendarContextValue>(
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
