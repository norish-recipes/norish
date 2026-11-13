import type { MenuItem } from "../components/card-menu";

/** What a recipe card's swipe offers, left to right. */
export function recipeSwipeActions(canDelete: boolean) {
  return canDelete ? (["groceries", "plan", "delete"] as const) : (["groceries", "plan"] as const);
}

export type RecipeSwipeAction = ReturnType<typeof recipeSwipeActions>[number];

/** How an action reads and looks: its i18n ids, its SF Symbol, and whether it is destructive. */
export type ActionDefinition = {
  labelId: string;
  /** The swipe's caption, where it differs from the menu's. */
  swipeLabelId?: string;
  icon: MenuItem["icon"];
  destructive?: boolean;
};

export type RecipeMenuAction =
  "favourite" | "groceries" | "plan" | "addToCookbook" | "removeFromCookbook" | "delete";

/** A recipe card's long-press menu, in the boards' order; Remove from cookbook only inside a cookbook the reader may edit. */
export function recipeMenuActions({
  canDelete,
  canRemoveFromCookbook,
}: {
  canDelete: boolean;
  canRemoveFromCookbook: boolean;
}): RecipeMenuAction[] {
  return [
    "favourite",
    "groceries",
    "plan",
    "addToCookbook",
    ...(canRemoveFromCookbook ? (["removeFromCookbook"] as const) : []),
    ...(canDelete ? (["delete"] as const) : []),
  ];
}

export type CookbookMenuAction = "addRecipes" | "rename" | "delete";

/** A cookbook card's long-press menu: filing and renaming need edit rights, deleting needs delete rights. */
export function cookbookMenuActions({
  canEdit,
  canDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
}): CookbookMenuAction[] {
  return [
    ...(canEdit ? (["addRecipes", "rename"] as const) : []),
    ...(canDelete ? (["delete"] as const) : []),
  ];
}

export function recipeActionDefinition(
  key: RecipeMenuAction,
  isFavorite: boolean
): ActionDefinition {
  const definitions: Record<RecipeMenuAction, ActionDefinition> = {
    favourite: isFavorite
      ? { labelId: "recipes.actions.unfavourite", icon: "heart.fill" }
      : { labelId: "recipes.actions.favourite", icon: "heart" },
    groceries: {
      labelId: "recipes.detail.addToGroceries",
      swipeLabelId: "recipes.actions.groceries",
      icon: "bag",
    },
    plan: { labelId: "recipes.actions.plan", icon: "calendar" },
    addToCookbook: { labelId: "recipes.selection.addToCookbook", icon: "book" },
    removeFromCookbook: {
      labelId: "recipes.cookbooks.removeFromCookbook",
      icon: "minus.circle",
      destructive: true,
    },
    delete: { labelId: "recipes.actions.delete", icon: "trash", destructive: true },
  };

  return definitions[key];
}

export const COOKBOOK_ACTION_DEFINITIONS: Record<CookbookMenuAction, ActionDefinition> = {
  addRecipes: { labelId: "recipes.cookbooks.addRecipes", icon: "plus" },
  rename: { labelId: "recipes.cookbooks.rename", icon: "pencil" },
  delete: { labelId: "recipes.actions.delete", icon: "trash", destructive: true },
};
