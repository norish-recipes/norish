import { TAB_ROUTES } from "@/lib/tab-routes";

/** What an add action takes: `compact` drops its label to the icon, where the accessory is narrow. */
export type AccessoryProps = { compact: boolean };

/** Which tab's add action the accessory holds. */
export type AddAction = "recipes" | "groceries" | "calendar";

/** What the accessory holds: a tab's add action, the timer capsule, or both. */
export type AccessoryPlan = { add: AddAction | null; capsule: boolean };

// Recipes is every other path.
const PATH_TABS = ["groceries", "calendar"] as const satisfies readonly AddAction[];
const WITHOUT_ADD = [TAB_ROUTES.groceries.pantry, TAB_ROUTES.groceries.food];

/** The accessory at `path`, or null when it holds nothing; the Pantry and its food sheet show the capsule alone. */
export function accessoryPlan(path: string, hasTimers: boolean): AccessoryPlan | null {
  const add: AddAction | null = WITHOUT_ADD.some((route) => path.startsWith(route))
    ? null
    : (PATH_TABS.find((tab) => path.startsWith(TAB_ROUTES[tab].root)) ?? "recipes");

  return add || hasTimers ? { add, capsule: hasTimers } : null;
}
