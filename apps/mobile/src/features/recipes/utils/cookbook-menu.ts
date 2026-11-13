import type { MenuIcon } from "./card-actions";

/** An SF Symbol's name, as a header item takes it. */
type SymbolName = Extract<MenuIcon, string>;

export type CookbookPageAction = "addRecipes" | "rename" | "changeCover" | "delete";

/** The cookbook page's menu, in the board's order: filing, naming and the cover need edit rights, deleting needs delete rights. */
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

/** How each action reads and looks in the native header menu. */
export const COOKBOOK_PAGE_DEFINITIONS: Record<
  CookbookPageAction,
  { labelId: string; icon: SymbolName; destructive?: boolean }
> = {
  addRecipes: { labelId: "recipes.cookbooks.addRecipes", icon: "plus" },
  rename: { labelId: "recipes.cookbooks.rename", icon: "pencil" },
  changeCover: { labelId: "recipes.cookbooks.changeCover", icon: "photo" },
  delete: { labelId: "recipes.cookbooks.deleteTitle", icon: "trash", destructive: true },
};
