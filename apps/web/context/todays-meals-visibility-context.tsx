"use client";

import { createDevicePreferenceContext } from "@/context/device-preference-context";
import { todaysMealsVisibilityPreference } from "@/lib/todays-meals-visibility";

/**
 * Mounted in the app shell so both consumers — the dashboard's Today block
 * and the settings select — read and write the same state. The shell's
 * server pass seeds it from the cookie; the offline bootstrap mounts the
 * shell unseeded and the provider reads the cookie itself.
 */
const { Provider: TodaysMealsVisibilityProvider, usePreference: useTodaySectionVisibility } =
  createDevicePreferenceContext(todaysMealsVisibilityPreference, "TodaysMealsVisibility");

export { TodaysMealsVisibilityProvider, useTodaySectionVisibility };
