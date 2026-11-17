import type Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";
import type { ComponentProps } from "react";
import { cookbookIdOf, cookModeRoute, TAB_ROUTES } from "@/lib/tab-routes";

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

/** What the accessory holds: an action, and the timer capsule while a timer exists. */
export type AccessoryPlan = { add: Action; capsule: boolean };

// Recipes is every other path.
const PATH_TABS = ["groceries", "calendar"] as const;
// The Pantry and the sheets it opens (`/groceries/pantry` prefixes the add sheet).
const PANTRY_PATHS = [TAB_ROUTES.groceries.pantry, TAB_ROUTES.groceries.food];

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

const ADD_TO_PANTRY: Action = {
  icon: "add-circle-outline",
  labelId: "groceries.pantry.add",
  testID: "add-pantry",
  route: TAB_ROUTES.groceries.pantryAdd,
};

const ADD_COOKBOOK: Action = {
  icon: "add-circle-outline",
  labelId: "recipes.cookbooks.addCookbook",
  testID: "add-cookbook",
  route: TAB_ROUTES.recipes.newCookbook,
};

const ADD_RECIPE: Action = {
  icon: "add-circle-outline",
  labelId: "recipes.dashboard.addRecipe",
  testID: "add-recipe",
  route: "/add-recipe",
};

const addRecipesTo = (cookbookId: string): Action => ({
  icon: "add-circle-outline",
  labelId: "recipes.cookbooks.addRecipes",
  testID: "cookbook-add-recipes-accessory",
  route: { pathname: TAB_ROUTES.recipes.cookbookAddRecipes, params: { cookbookId } },
});

/** What the Recipes tab adds: a cookbook on the Cookbooks lens at the root, recipes to a cookbook
 * the Reader may edit on its page, else a recipe. */
const recipesAdd = (path: string, lens: LibraryTypeFilter, editableCookbook: string | null) => {
  if (path === TAB_ROUTES.recipes.root && lens === "cookbooks") return ADD_COOKBOOK;

  return editableCookbook && cookbookIdOf(path) === editableCookbook
    ? addRecipesTo(editableCookbook)
    : ADD_RECIPE;
};

const cookAction = (recipeId: string): Action => ({
  icon: "play-circle-outline",
  labelId: "recipes.detail.cook",
  testID: "cook-recipe",
  route: cookModeRoute(recipeId),
});

const onPantry = (path: string) => PANTRY_PATHS.some((route) => path.startsWith(route));

const tabOf = (path: string) => PATH_TABS.find((tab) => path.startsWith(TAB_ROUTES[tab].root));

/** The tab `path` is on: its own first segment, Recipes for the library, its pages and sheets. */
export function shellTab(path: string) {
  const first = path.split("/")[1];

  return first === "groceries" || first === "calendar" || first === "settings" || first === "search"
    ? first
    : "recipes";
}

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

/** The accessory for `screen`: Cook on a recipe, Add to pantry on the Pantry, else the tab's own
 * action; `editableCookbook` is the cookbook on screen when the Reader may edit it. */
export function accessoryPlan(
  { path, recipeId }: AccessoryScreen,
  hasTimers: boolean,
  lens: LibraryTypeFilter,
  editableCookbook: string | null = null
): AccessoryPlan {
  const tab = tabOf(path);
  const add = recipeId
    ? cookAction(recipeId)
    : onPantry(path)
      ? ADD_TO_PANTRY
      : tab
        ? TAB_ACTIONS[tab]
        : recipesAdd(path, lens, editableCookbook);

  return { add, capsule: hasTimers };
}

/** The action icon's size. */
export const ACTION_ICON = 22;
/** What an action's label needs beside it: the icon, the gap and 6 pt each side, clear of the capsule's curve. */
export const ACTION_CHROME = ACTION_ICON + 8 + 2 * 6;
