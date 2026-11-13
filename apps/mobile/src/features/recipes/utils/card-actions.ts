/** What a recipe card's swipe offers, left to right. */
export function recipeSwipeActions(canDelete: boolean): ("groceries" | "plan" | "delete")[] {
  return canDelete ? ["groceries", "plan", "delete"] : ["groceries", "plan"];
}

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
