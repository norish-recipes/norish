"use client";

import { useDevicePreference } from "@/context/device-preferences-context";

/** Today's meals on the dashboard: always, only when planned, or hidden. */
export function useTodaySectionVisibility() {
  return useDevicePreference("todaysMeals");
}
