"use client";

import { createContext, useContext, ReactNode, useMemo, useState, useCallback } from "react";

import {
  useCalendarQuery,
  useCalendarMutations,
  useCalendarSubscription,
  type CalendarData,
} from "@/hooks/calendar";
import { Slot, CaldavItemType } from "@/types";
import { dateKey, startOfMonth, endOfMonth, addMonths } from "@/lib/helpers";

type Ctx = {
  plannedItemsByDate: CalendarData;
  isLoading: boolean;
  planMeal: (date: string, slot: Slot, recipeId: string, recipeName: string, recipeTags?: string[]) => void;
  planNote: (date: string, slot: Slot, title: string) => void;
  deletePlanned: (id: string, date: string, itemType: CaldavItemType) => void;
  updateItemDate: (id: string, oldDate: string, newDate: string, itemType: CaldavItemType) => void;
};

const CalendarContext = createContext<Ctx | null>(null);

export function CalendarContextProvider({ children }: { children: ReactNode }) {
  // Default range: previous month to next month
  const [dateRange] = useState(() => {
    const now = new Date();

    return {
      start: startOfMonth(addMonths(now, -1)),
      end: endOfMonth(addMonths(now, 1)),
    };
  });

  const startISO = dateKey(dateRange.start);
  const endISO = dateKey(dateRange.end);

  const { calendarData, isLoading } = useCalendarQuery(startISO, endISO);
  const {
    createPlannedRecipe,
    deletePlannedRecipe,
    updatePlannedRecipeDate,
    createNote,
    deleteNote,
    updateNoteDate,
  } = useCalendarMutations(startISO, endISO);

  // Subscribe to WebSocket events
  useCalendarSubscription(startISO, endISO);

  const planMeal = useCallback(
    (date: string, slot: Slot, recipeId: string, recipeName: string, recipeTags?: string[]): void => {
      createPlannedRecipe(date, slot, recipeId, recipeName, recipeTags);
    },
    [createPlannedRecipe]
  );

  const planNote = useCallback(
    (date: string, slot: Slot, title: string): void => {
      createNote(date, slot, title);
    },
    [createNote]
  );

  const deletePlanned = useCallback(
    (id: string, date: string, itemType: CaldavItemType): void => {
      if (itemType === "recipe") {
        deletePlannedRecipe(id, date);
      } else {
        deleteNote(id, date);
      }
    },
    [deletePlannedRecipe, deleteNote]
  );

  const updateItemDate = useCallback(
    (id: string, oldDate: string, newDate: string, itemType: CaldavItemType): void => {
      if (itemType === "recipe") {
        updatePlannedRecipeDate(id, newDate, oldDate);
      } else {
        updateNoteDate(id, newDate, oldDate);
      }
    },
    [updatePlannedRecipeDate, updateNoteDate]
  );

  const value = useMemo<Ctx>(
    () => ({
      plannedItemsByDate: calendarData,
      isLoading,
      planMeal,
      planNote,
      deletePlanned,
      updateItemDate,
    }),
    [calendarData, isLoading, planMeal, planNote, deletePlanned, updateItemDate]
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendarContext() {
  const ctx = useContext(CalendarContext);

  if (!ctx) throw new Error("useCalendarContext must be used within CalendarContextProvider");

  return ctx;
}
