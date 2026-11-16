export type SortOrder = "titleAsc" | "titleDesc" | "dateAsc" | "dateDesc" | "none";
export type FilterMode = "AND" | "OR";
export type SearchField = "title" | "description" | "ingredients" | "steps" | "tags";

export const SEARCH_FIELDS: readonly SearchField[] = [
  "title",
  "description",
  "ingredients",
  "steps",
  "tags",
] as const;

export const DEFAULT_SEARCH_FIELDS: readonly SearchField[] = ["title", "ingredients"] as const;

/**
 * Which kind of thing the Library is showing: everything, only recipes, or
 * only cookbooks. It is a lens on the list rather than a filter on a recipe,
 * which is why it is deliberately excluded from "has applied filters" and
 * from Clear filters (ADR-0026).
 */
export type LibraryTypeFilter = "all" | "recipes" | "cookbooks";

export const LIBRARY_TYPE_FILTERS: readonly LibraryTypeFilter[] = [
  "all",
  "recipes",
  "cookbooks",
] as const;

/** The kinds of row a Library list can hold. */
export type LibraryKind = "recipe" | "cookbook";

/** Whether the `lens` lists `kind`: the Cookbooks lens holds no recipes, the Recipes lens no cookbooks. */
export function lensHoldsKind(lens: LibraryTypeFilter, kind: LibraryKind) {
  return lens === "all" || lens === `${kind}s`;
}

export const DEFAULT_LIBRARY_TYPE_FILTER: LibraryTypeFilter = "all";
