import { TAB_ROUTES } from "@/lib/tab-routes";

/** What an add action takes: `compact` drops its label to the icon, where the accessory is narrow. */
export type AccessoryProps = { compact: boolean };

/** Which tab's add action the accessory holds: the tab's key in `TAB_ROUTES`. */
export type AddAction = keyof typeof TAB_ROUTES;

// The tabs told by their path; Recipes is every other path.
const PATH_TABS = ["groceries", "calendar"] as const;
const WITHOUT_ADD = [TAB_ROUTES.groceries.pantry, TAB_ROUTES.groceries.food];

/**
 * What the bottom accessory holds at `path`: the tab's add action, the timer capsule while a timer
 * exists, or nothing. The Pantry (and its food sheet) has no add action: it shows the capsule alone.
 */
export function accessoryPlan(path: string, hasTimers: boolean) {
  const add: AddAction | null = WITHOUT_ADD.some((route) => path.startsWith(route))
    ? null
    : (PATH_TABS.find((tab) => path.startsWith(TAB_ROUTES[tab].root)) ?? "recipes");

  return add || hasTimers ? { add, capsule: hasTimers } : null;
}
