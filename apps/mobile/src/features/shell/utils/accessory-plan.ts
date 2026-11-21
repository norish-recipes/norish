import type { GroceriesSection } from "@/lib/groceries-section";
import type Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";
import type { ComponentProps } from "react";
import { cookbookIdOf, cookModeRoute, TAB_ROUTES } from "@/lib/tab-routes";

import type { LibraryTypeFilter } from "@norish/shared/contracts";

/** The screen the accessory is for: its path, its recipe when that is a shown recipe's page, and
 * `search` when it is in the Search tab's stack, whose pages have no path of their own to say so. */
export type AccessoryScreen = { path: string; recipeId?: string; search?: boolean };

/** One action the accessory holds: its icon, label, test id and the route it opens. */
export type Action = {
  icon: ComponentProps<typeof Ionicons>["name"];
  labelId: string;
  testID: string;
  route: Href;
};

/** What the accessory holds: an action (none on Search's own pages), and the timer capsule while a timer exists. */
export type AccessoryPlan = { add: Action | null; capsule: boolean };

// Recipes is every other path.
const PATH_TABS = ["groceries", "calendar"] as const;

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

const tabOf = (path: string) => PATH_TABS.find((tab) => path.startsWith(TAB_ROUTES[tab].root));

/** The tab `path` is on: its own first segment, Recipes for the library, its pages and sheets;
 * Search, `inSearch`, for every page of its stack. */
export function shellTab(path: string, inSearch = false) {
  const first = path.split("/")[1];

  if (inSearch) return "search";

  return first === "groceries" || first === "calendar" || first === "settings" ? first : "recipes";
}

/** The tab page shown at `path`: itself on a tab, else the last one, under a root sheet such as the
 * timers, so the accessory keeps that page's action while the sheet opens and closes. */
export const tabPage = (path: string, onTab: boolean, lastTabPage: string) =>
  onTab ? path : lastTabPage;

/** The screen the accessory is for at `path` (in Search's stack when `search`): the recipe's once
 * its page is shown with it, until then the last path that was not a recipe's. */
export function accessoryScreen(
  path: string,
  recipeId: string | undefined,
  lastNonRecipePath: string,
  shownRecipe: string | null,
  search = false
): AccessoryScreen {
  const inSearch = search ? { search } : {};

  if (recipeId === undefined) return { path, ...inSearch };
  if (recipeId === shownRecipe) return { path, recipeId, ...inSearch };
  if (search) return { path: lastNonRecipePath, ...inSearch };

  // A recipe opens on the Recipes tab, though the way in was another tab's.
  return { path: tabOf(lastNonRecipePath) ? TAB_ROUTES.recipes.root : lastNonRecipePath };
}

/** The accessory for `screen`: Cook on a recipe, Add to pantry while the Groceries page shows the
 * Pantry (`groceries`, sheets too), else the tab's own; `editableCookbook` is one the Reader may edit. */
export function accessoryPlan(
  { path, recipeId, search }: AccessoryScreen,
  hasTimers: boolean,
  lens: LibraryTypeFilter,
  editableCookbook: string | null = null,
  groceries: GroceriesSection = "list"
): AccessoryPlan {
  const tab = tabOf(path);
  const add = recipeId
    ? cookAction(recipeId)
    : search
      ? null
      : tab === "groceries" && groceries === "pantry"
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
