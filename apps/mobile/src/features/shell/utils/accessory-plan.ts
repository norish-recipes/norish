import { recipeIdOf, TAB_ROUTES } from "@/lib/tab-routes";

/** What an action takes: `inline` when the accessory sits beside the minimised tab bar, where the
 * label goes if it does not fit; `path` is the screen the accessory is labelled for. */
export type AccessoryProps = { inline: boolean; path: string };

/** Which action the accessory holds: a tab's add action, or Cook on a recipe. */
export type AddAction = "recipes" | "groceries" | "calendar" | "cook";

/** What the accessory holds: its action, the timer capsule, or both. */
export type AccessoryPlan = { add: AddAction | null; capsule: boolean };

// Recipes is every other path.
const PATH_TABS = ["groceries", "calendar"] as const satisfies readonly AddAction[];
const WITHOUT_ADD = [TAB_ROUTES.groceries.pantry, TAB_ROUTES.groceries.food];

/** The path the accessory is labelled for: a recipe's once its page is shown with the recipe on it,
 * until then the screen below it (`below`, the last path that was not a recipe's). */
export function shownPath(path: string, below: string, shownRecipe: string | null) {
  const id = recipeIdOf(path);

  if (id === undefined || id === shownRecipe) return path;

  // A recipe opens on the Recipes tab, though the way in was another tab's.
  return PATH_TABS.some((tab) => below.startsWith(TAB_ROUTES[tab].root))
    ? TAB_ROUTES.recipes.root
    : below;
}

/** The accessory at `path`, or null when it holds nothing: Cook on a recipe, the capsule alone on
 * the Pantry and its food sheet. */
export function accessoryPlan(path: string, hasTimers: boolean): AccessoryPlan | null {
  const add: AddAction | null =
    recipeIdOf(path) !== undefined
      ? "cook"
      : WITHOUT_ADD.some((route) => path.startsWith(route))
        ? null
        : (PATH_TABS.find((tab) => path.startsWith(TAB_ROUTES[tab].root)) ?? "recipes");

  return add || hasTimers ? { add, capsule: hasTimers } : null;
}

/** The action icon's size. */
export const ACTION_ICON = 22;
const GAP = 8;
// Clear of the capsule's curve at the label's height.
const SIDES = 6;

/** Whether an action's label fits beside its icon in `room` pt; null until both are measured. */
export function labelFits(room: number | null, labelWidth: number | null) {
  if (room === null || labelWidth === null) return null;

  return SIDES * 2 + ACTION_ICON + GAP + labelWidth <= room;
}
