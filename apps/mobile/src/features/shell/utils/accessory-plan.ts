import { TAB_ROUTES } from "@/lib/tab-routes";

/** Which tab's add action the accessory holds. */
export type AddAction = "recipes" | "groceries" | "calendar";

/**
 * What the bottom accessory holds at `path`: the tab's add action, the timer capsule while a timer
 * exists, or nothing. The Pantry (and its food sheet) has no add action: it shows the capsule alone.
 */
export function accessoryPlan(path: string, hasTimers: boolean) {
  const onPantry =
    path.startsWith(TAB_ROUTES.groceries.pantry) || path.startsWith(TAB_ROUTES.groceries.food);
  const add: AddAction | null = onPantry
    ? null
    : path.startsWith(TAB_ROUTES.groceries.root)
      ? "groceries"
      : path.startsWith(TAB_ROUTES.calendar.root)
        ? "calendar"
        : "recipes";

  return add || hasTimers ? { add, capsule: hasTimers } : null;
}
