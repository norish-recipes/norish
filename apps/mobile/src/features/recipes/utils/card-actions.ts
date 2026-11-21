import type { Link } from "expo-router";
import type { ComponentProps } from "react";

/** What a recipe card's swipe offers, left to right. */
export function recipeSwipeActions(canDelete: boolean) {
  return canDelete ? (["groceries", "plan", "delete"] as const) : (["groceries", "plan"] as const);
}

export type RecipeSwipeAction = ReturnType<typeof recipeSwipeActions>[number];

/** An SF Symbol, as the native context menu takes it. */
export type MenuIcon = ComponentProps<typeof Link.MenuAction>["icon"];

/** How an action reads and looks: its i18n ids, its SF Symbol, and whether it is destructive. */
export type ActionDefinition = {
  labelId: string;
  /** The swipe's caption, where it differs from the menu's. */
  swipeLabelId?: string;
  icon: MenuIcon;
  destructive?: boolean;
};

export type RecipeMenuAction =
  "favourite" | "groceries" | "plan" | "addToCookbook" | "removeFromCookbook" | "delete";

/** A recipe card's long-press menu; Remove from cookbook only inside a cookbook the reader may edit. */
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

export type CookbookPageAction = CookbookMenuAction | "changeCover";

/** The cookbook page's header menu: the card's, with Change cover among the edits. */
export function cookbookPageActions({
  canEdit,
  canDelete,
}: {
  canEdit: boolean;
  canDelete: boolean;
}): CookbookPageAction[] {
  return [
    ...(canEdit ? (["addRecipes", "rename", "changeCover"] as const) : []),
    ...(canDelete ? (["delete"] as const) : []),
  ];
}

const DELETE: ActionDefinition = {
  labelId: "recipes.actions.delete",
  icon: "trash",
  destructive: true,
};

/** A favourited recipe's menu offers `unfavourite` in the `favourite` slot. */
export const RECIPE_ACTION_DEFINITIONS: Record<RecipeMenuAction | "unfavourite", ActionDefinition> =
  {
    favourite: { labelId: "recipes.actions.favourite", icon: "heart" },
    unfavourite: { labelId: "recipes.actions.unfavourite", icon: "heart.fill" },
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
    delete: DELETE,
  };

export const COOKBOOK_ACTION_DEFINITIONS: Record<CookbookPageAction, ActionDefinition> = {
  addRecipes: { labelId: "recipes.cookbooks.addRecipes", icon: "plus" },
  rename: { labelId: "recipes.cookbooks.rename", icon: "pencil" },
  changeCover: { labelId: "recipes.cookbooks.changeCover", icon: "photo" },
  delete: DELETE,
};
