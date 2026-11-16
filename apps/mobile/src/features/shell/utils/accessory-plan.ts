import type Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";
import type { ComponentProps } from "react";
import { cookModeRoute, TAB_ROUTES } from "@/lib/tab-routes";

import type { LibraryTypeFilter } from "@norish/shared/contracts";

/** The screen the accessory is for: its path, and its recipe when that is a shown recipe's page. */
export type AccessoryScreen = { path: string; recipeId?: string };

/** One action the accessory holds: its icon, label, test id and the route it opens. */
export type Action = {
  icon: ComponentProps<typeof Ionicons>["name"];
  labelId: string;
  testID: string;
  route: Href;
};

/** What the accessory holds: an action, the timer capsule, or both. Add recipe depends on the
 * cookbook it is on, so it is `"addRecipe"`, drawn by a component of its own. */
export type AccessoryPlan = { add: Action | "addRecipe" | null; capsule: boolean };

// Recipes is every other path.
const PATH_TABS = ["groceries", "calendar"] as const;
const WITHOUT_ADD = [TAB_ROUTES.groceries.pantry, TAB_ROUTES.groceries.food];

const TAB_ACTIONS: Record<(typeof PATH_TABS)[number], Action> = {
  groceries: {
    icon: "add-circle-outline",
    labelId: "groceries.page.addItems",
    testID: "add-grocery",
    route: TAB_ROUTES.groceries.add,
  },
  calendar: {
    icon: "calendar-outline",
    labelId: "calendar.mobile.planRecipe",
    testID: "plan-recipe-accessory",
    route: TAB_ROUTES.calendar.planRecipe,
  },
};

const ADD_COOKBOOK: Action = {
  icon: "add-circle-outline",
  labelId: "recipes.cookbooks.addCookbook",
  testID: "add-cookbook",
  route: TAB_ROUTES.recipes.newCookbook,
};

/** What the Recipes tab adds: a cookbook while the Library at its root shows the Cookbooks lens, else a recipe. */
const recipesAdd = (path: string, lens: LibraryTypeFilter): Action | "addRecipe" =>
  path === TAB_ROUTES.recipes.root && lens === "cookbooks" ? ADD_COOKBOOK : "addRecipe";

const cookAction = (recipeId: string): Action => ({
  icon: "play-circle-outline",
  labelId: "recipes.detail.cook",
  testID: "cook-recipe",
  route: cookModeRoute(recipeId),
});

const tabOf = (path: string) => PATH_TABS.find((tab) => path.startsWith(TAB_ROUTES[tab].root));

/** The screen the accessory is for at `path`, whose recipe is `recipeId`: the recipe's once its page
 * is shown with it, until then the last path that was not a recipe's, on the Recipes tab. */
export function accessoryScreen(
  path: string,
  recipeId: string | undefined,
  lastNonRecipePath: string,
  shownRecipe: string | null
): AccessoryScreen {
  if (recipeId === undefined) return { path };
  if (recipeId === shownRecipe) return { path, recipeId };

  // A recipe opens on the Recipes tab, though the way in was another tab's.
  return { path: tabOf(lastNonRecipePath) ? TAB_ROUTES.recipes.root : lastNonRecipePath };
}

/** The accessory for `screen`, or null when it holds nothing: Cook on a recipe, Add cookbook while
 * the Library at the Recipes root shows `lens` Cookbooks, the capsule alone on the Pantry and its
 * food sheet. */
export function accessoryPlan(
  { path, recipeId }: AccessoryScreen,
  hasTimers: boolean,
  lens: LibraryTypeFilter
): AccessoryPlan | null {
  const tab = tabOf(path);
  const add: AccessoryPlan["add"] = recipeId
    ? cookAction(recipeId)
    : WITHOUT_ADD.some((route) => path.startsWith(route))
      ? null
      : tab
        ? TAB_ACTIONS[tab]
        : recipesAdd(path, lens);

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
