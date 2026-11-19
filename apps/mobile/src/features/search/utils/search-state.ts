import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { hasAppliedRecipeFilters } from "@norish/shared/contracts/filter-contract";

/** Which page of Search shows. Later tickets add typing suggestions, discover sections and Offline here. */
export type SearchView = "rested" | "focused" | "typing" | "results" | "none";

/** What the choice reads: `resultCount` is null while the search is loading. */
export type SearchViewInput = {
  text: string;
  /** The search key, a chip or a discover row was used since the text last changed. */
  confirmed: boolean;
  focused: boolean;
  resultCount: number | null;
};

export function searchView({ text, confirmed, focused, resultCount }: SearchViewInput): SearchView {
  if (confirmed) return resultCount === 0 ? "none" : "results";
  if (text.trim().length > 0) return "typing";

  return focused ? "focused" : "rested";
}

/** Whether a chip filters, not counting the text: the text is the field's, not a chip. */
export const hasSearchFilters = (filters: CanonicalRecipeFilters) =>
  hasAppliedRecipeFilters({ ...filters, rawInput: "" });

export type NoResults = "clear-filters" | "search-all-fields" | "plain";

/** What the no-results page offers: loosen the filters first, then widen the Search Scope, else nothing. */
export function noResultsVariant(hasFilters: boolean, scopeNarrowed: boolean): NoResults {
  if (hasFilters) return "clear-filters";

  return scopeNarrowed ? "search-all-fields" : "plain";
}
