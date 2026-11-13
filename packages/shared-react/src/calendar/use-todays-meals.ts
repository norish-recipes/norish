import { useState } from "react";

import type { TodaySectionVisibility } from "@norish/shared/contracts/zod/device-preferences";
import { getInitialCalendarRange, parseDateKey } from "@norish/shared/lib/helpers";

import { groupTodayItemsBySlot, TODAY_MEAL_SLOTS } from "./todays-meals";
import { useCalendarQuery } from "./use-calendar-query";
import { useCalendarSubscription } from "./use-calendar-subscription";

/**
 * Today's plan by slot and the slots the Device Preference shows: all four, or only the planned
 * ones. Planned-only can leave none, so a screen shows nothing until the plan says.
 */
export function useTodaysMeals(todayKey: string, visibility: TodaySectionVisibility) {
  // The week the dashboard layout seeds, frozen at mount so a later today never reads an uncached one.
  const [week] = useState(() => getInitialCalendarRange("desktop", todayKey));
  const { calendarData, isLoading } = useCalendarQuery(week);

  useCalendarSubscription();

  const itemsBySlot = groupTodayItemsBySlot(calendarData[todayKey] ?? []);
  const visibleSlots =
    visibility === "planned"
      ? TODAY_MEAL_SLOTS.filter((slot) => itemsBySlot[slot].length > 0)
      : TODAY_MEAL_SLOTS;

  return { todayDate: parseDateKey(todayKey), itemsBySlot, visibleSlots, isLoading };
}
