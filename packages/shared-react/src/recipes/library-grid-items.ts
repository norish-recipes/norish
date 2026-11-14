import type {
  CookbookSummaryDTO,
  LibraryItemDTO,
  LibraryTypeFilter,
  RecipeDashboardDTO,
} from "@norish/shared/contracts";

/** One row of the Library, which mixes kinds in one list (ADR-0026), so each row names its kind;
 * `pending` is a running import's placeholder. */
export type LibraryGridItem =
  | { kind: "pending"; id: string }
  | { kind: "recipe"; id: string; recipe: RecipeDashboardDTO }
  | { kind: "cookbook"; id: string; cookbook: CookbookSummaryDTO };

/** The Library's rows: running imports first, then the page's items. The Cookbooks lens leaves imports out, a running import being a recipe on its way. */
export function libraryGridItems(
  items: readonly LibraryItemDTO[],
  pendingRecipeIds: Iterable<string>,
  libraryType: LibraryTypeFilter | undefined
): LibraryGridItem[] {
  const pending = libraryType === "cookbooks" ? [] : Array.from(pendingRecipeIds);

  return [
    ...pending.map((id) => ({ kind: "pending" as const, id })),
    ...items.map((item) =>
      item.kind === "recipe"
        ? { kind: "recipe" as const, id: item.recipe.id, recipe: item.recipe }
        : { kind: "cookbook" as const, id: item.cookbook.id, cookbook: item.cookbook }
    ),
  ];
}

/** A cookbook's members as rows. */
export function recipeGridItems(recipes: readonly RecipeDashboardDTO[]): LibraryGridItem[] {
  return recipes.map((recipe) => ({ kind: "recipe", id: recipe.id, recipe }));
}
