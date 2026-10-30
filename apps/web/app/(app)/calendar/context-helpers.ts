import { addWeeks, dateKey, getWeekEnd, getWeekStart } from "@norish/shared/lib/helpers";

import type { CalendarDateRange } from "./context-types";

/** The range a calendar opens on around `today` (`YYYY-MM-DD`), the reader's date by default. */
export function getInitialDateRange(
  mode: "desktop" | "mobile",
  today: string = dateKey(new Date())
): CalendarDateRange {
  const now = new Date(`${today}T00:00:00`);

  if (mode === "desktop") {
    return {
      start: getWeekStart(now),
      end: getWeekEnd(now),
    };
  }

  return {
    start: getWeekStart(addWeeks(now, -2)),
    end: getWeekEnd(addWeeks(now, 2)),
  };
}
