"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { createStore } from "zustand";

import { dateKey, getInitialCalendarRange, parseDateKey } from "@norish/shared/lib/helpers";

import type { CalendarRange } from "./calendar-cache-merge";
import { createPageStoreContext } from "../page-store";
import { isDateInRange } from "./calendar-cache-merge";

// Divisible by both 2 and 3 columns, so growing never shifts the grid.
const GROW_DAYS = 12;

export type CalendarRangeState = {
  range: CalendarRange;
  /** Briefly true after a grow, so a scroll resting near an edge grows once. */
  isGrowing: boolean;
  grow: (direction: "past" | "future") => void;
  isDateInRange: (date: string) => boolean;
};

function shiftDays(iso: string, days: number) {
  const date = parseDateKey(iso);

  date.setDate(date.getDate() + days);

  return dateKey(date);
}

/** The calendar's range, opening two weeks either side of `today` (`YYYY-MM-DD`). */
export function createCalendarRangeStore(today: string) {
  return createStore<CalendarRangeState>()((set, get) => ({
    range: getInitialCalendarRange("mobile", today),
    isGrowing: false,
    grow: (direction) => {
      const { range, isGrowing } = get();

      if (isGrowing) return;
      set({
        isGrowing: true,
        range:
          direction === "past"
            ? { ...range, startISO: shiftDays(range.startISO, -GROW_DAYS) }
            : { ...range, endISO: shiftDays(range.endISO, GROW_DAYS) },
      });
      // Long enough for the wider read to start before an edge can grow it again.
      setTimeout(() => set({ isGrowing: false }), 100);
    },
    isDateInRange: (date) => isDateInRange(date, get().range),
  }));
}

const calendarRange = createPageStoreContext("CalendarRangeProvider", createCalendarRangeStore);

/** Makes the calendar's range once from `today`; a later today keeps the range. */
export function CalendarRangeProvider({ today, children }: { today: string; children: ReactNode }) {
  const [first] = useState(today);

  return <calendarRange.Provider pageKey={first}>{children}</calendarRange.Provider>;
}

/** One slice of the calendar's range store; renders when that slice changes. */
export const useCalendarRange = calendarRange.usePageStore;
