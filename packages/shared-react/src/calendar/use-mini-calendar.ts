import {
  addMonths,
  dateKey,
  eachDayOfInterval,
  endOfMonth,
  startOfMonth,
} from "@norish/shared/lib/helpers";

import type { CalendarData } from "./types";
import { useCalendarQuery } from "./use-calendar-query";
import { useCalendarSubscription } from "./use-calendar-subscription";

/** The days a planning calendar offers: last month's first day to next month's last. */
export function miniCalendarRange(today: Date) {
  const start = startOfMonth(addMonths(today, -1));
  const end = endOfMonth(addMonths(today, 1));

  return {
    startISO: dateKey(start),
    endISO: dateKey(end),
    days: eachDayOfInterval(start, end),
  };
}

/**
 * What a planning calendar shows: every day of the range, the plan of each, and where today is.
 * `today` has to stay the same Date for as long as the calendar is open.
 */
export function useMiniCalendar(today: Date): {
  days: Date[];
  todayKey: string;
  todayIndex: number;
  calendarData: CalendarData;
  isLoading: boolean;
} {
  const { startISO, endISO, days } = miniCalendarRange(today);
  const { calendarData, isLoading } = useCalendarQuery({ startISO, endISO });
  const todayKey = dateKey(today);

  useCalendarSubscription();

  return {
    days,
    todayKey,
    todayIndex: days.findIndex((day) => dateKey(day) === todayKey),
    calendarData,
    isLoading,
  };
}
