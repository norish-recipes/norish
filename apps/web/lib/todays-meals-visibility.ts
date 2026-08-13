import { defineDevicePreference } from "@/lib/device-preferences";

export type TodaySectionVisibility = "always" | "planned" | "hidden";

/**
 * Today's meals placement is a device-local three-state rule — always, only
 * when something is planned, hidden — and the worst flicker in the app when
 * the server cannot see it: a hidden reader watched the whole block paint
 * and vanish on every load. Riding a cookie lets the dashboard's server
 * render apply the rule before anything paints.
 */
export const todaysMealsVisibilityPreference = defineDevicePreference({
  cookieName: "norish_todays_meals_visibility",
  values: ["always", "planned", "hidden"] as const satisfies readonly TodaySectionVisibility[],
  defaultValue: "always",
});
