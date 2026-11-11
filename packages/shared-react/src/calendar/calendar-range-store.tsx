"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { createStore } from "zustand";

import type { CalendarRange } from "@norish/shared/lib/helpers";
import { dateKey, getInitialCalendarRange, parseDateKey } from "@norish/shared/lib/helpers";

import { createPageStoreContext } from "../page-store";

// Divisible by both 2 and 3 columns, so growing never shifts the grid.
const GROW_DAYS = 12;

/** Which edge of the calendar's range grows. */
export type GrowDirection = "past" | "future";

export type CalendarRangeState = {
  range: CalendarRange;
  /** Briefly true after a grow either way, so a scroll resting near an edge grows once. */
  isGrowing: boolean;
  grow: (direction: GrowDirection) => void;
};

function shiftDays(iso: string, days: number) {
  const date = parseDateKey(iso);

  date.setDate(date.getDate() + days);

  return dateKey(date);
}

/** The calendar's range, opening two weeks either side of `today` (`YYYY-MM-DD`). */
export function createCalendarRangeStore(today: string) {
  // Per direction, so a tall screen at both edges grows both ways in one tick.
  const settling = new Set<GrowDirection>();

  return createStore<CalendarRangeState>()((set, get) => ({
    range: getInitialCalendarRange("mobile", today),
    isGrowing: false,
    grow: (direction) => {
      if (settling.has(direction)) return;
      settling.add(direction);

      const { range } = get();

      set({
        isGrowing: true,
        range:
          direction === "past"
            ? { ...range, startISO: shiftDays(range.startISO, -GROW_DAYS) }
            : { ...range, endISO: shiftDays(range.endISO, GROW_DAYS) },
      });
      // Long enough for the wider read to start before that edge can grow it again.
      setTimeout(() => {
        settling.delete(direction);
        set({ isGrowing: settling.size > 0 });
      }, 100);
    },
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
