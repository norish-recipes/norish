"use client";

import { useState } from "react";

import { useCalendarRange } from "./calendar-range-store";
import { useCalendarQuery } from "./use-calendar-query";

/** The calendar page's range, its grow and what is planned in it; loading until the first read settles. */
export function useCalendarRangeQuery() {
  const range = useCalendarRange((state) => state.range);
  const isGrowing = useCalendarRange((state) => state.isGrowing);
  const grow = useCalendarRange((state) => state.grow);
  const { calendarData, isLoading } = useCalendarQuery(range);
  // Set once, so a grown range with nothing cached (after a failed read) keeps the timeline.
  const [hasSettled, setHasSettled] = useState(false);

  if (!isLoading && !hasSettled) setHasSettled(true);

  return { range, isGrowing, grow, calendarData, isLoading: isLoading && !hasSettled };
}
