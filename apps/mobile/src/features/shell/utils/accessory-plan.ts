import { TAB_ROUTES } from "@/lib/tab-routes";

/** What an action takes: `inline` when the accessory sits beside the minimised tab bar, where the
 * label goes if it does not fit. */
export type AccessoryProps = { inline: boolean };

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

/** The action icon's size. */
export const ACTION_ICON = 22;
const GAP = 8;
const SIDES = 12;

/** Whether an action's label fits beside its icon in `room` pt; true until both are measured. */
export function labelFits(room: number | null, labelWidth: number | null) {
  return room === null || labelWidth === null || SIDES * 2 + ACTION_ICON + GAP + labelWidth <= room;
}
