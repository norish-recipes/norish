import { addWeeks, getWeekEnd, getWeekStart } from "@norish/shared/lib/helpers";

import type { CalendarDateRange } from "./context-types";

export function getInitialDateRange(mode: "desktop" | "mobile"): CalendarDateRange {
  const now = new Date();

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
