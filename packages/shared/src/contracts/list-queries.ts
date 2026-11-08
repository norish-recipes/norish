import type { toRecipesQueryFilters } from "./filter-contract";

/** Filters as the list queries take them: toRecipesQueryFilters' answer, or any part of it. */
export type ListQueryFilters = Partial<ReturnType<typeof toRecipesQueryFilters>> & {
  limit?: number;
};

/** The fields and defaults both list queries share. */
function listQueryInput(
  {
    search,
    searchFields,
    tags,
    categories,
    filterMode = "AND",
    sortMode = "dateDesc",
    minRating,
    maxCookingTime,
    favoritesOnly = false,
    pantryOnly = false,
  }: ListQueryFilters,
  limit: number
) {
  return {
    limit,
    search,
    searchFields,
    tags,
    categories,
    filterMode,
    sortMode,
    minRating,
    maxCookingTime,
    favoritesOnly,
    pantryOnly,
  };
}

/** The Library query's input, as the Library asks for it; the server seeds the same one. */
export function libraryListInput(filters: ListQueryFilters = {}) {
  // The recipe list's default too, so the Warm Set's floor and the first page are one cache entry
  // (ADR-0009).
  return { ...listQueryInput(filters, filters.limit ?? 100), type: filters.type ?? "all" };
}

/** The members query's input, as the cookbook page asks; the Warm Set and the server use it too. */
export function cookbookRecipesInput(cookbookId: string, filters: ListQueryFilters = {}) {
  return { cookbookId, ...listQueryInput(filters, filters.limit ?? 50) };
}

/** How both list queries page: from the cursor their last page names. */
export const byNextCursor = {
  getNextPageParam: (lastPage: { nextCursor: number | null }) => lastPage.nextCursor,
};
