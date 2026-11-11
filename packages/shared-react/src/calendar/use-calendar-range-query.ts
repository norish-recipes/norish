"use client";

import { useCalendarRange } from "./calendar-range-store";
import { useCalendarQuery } from "./use-calendar-query";

/** The calendar page's range and what is planned in it. */
export function useCalendarRangeQuery() {
  const range = useCalendarRange((state) => state.range);
  // A grown range starts from the days already read, so only the first read shows the skeleton.
  const { calendarData, isLoading } = useCalendarQuery(range);

  return { range, calendarData, isLoading };
}
