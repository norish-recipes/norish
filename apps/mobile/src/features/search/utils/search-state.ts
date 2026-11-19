/** Which page of Search shows. */
export type SearchView = "rested" | "focused" | "typing" | "results" | "none";

/** What the choice reads: `resultCount` is null while the search is loading. */
export type SearchViewInput = {
  text: string;
  /** The search key was used since the text last changed. */
  confirmed: boolean;
  /** At least one filter chip is applied. */
  hasChips: boolean;
  focused: boolean;
  resultCount: number | null;
};

/** Results show for a confirmed text, or while a chip filters an empty one; no text and no chips rests. */
export const showsResults = ({ text, confirmed, hasChips }: SearchViewInput) =>
  text.trim() === "" ? hasChips : confirmed;

export function searchView(input: SearchViewInput): SearchView {
  if (showsResults(input)) return input.resultCount === 0 ? "none" : "results";
  if (input.text.trim().length > 0) return "typing";

  return input.focused ? "focused" : "rested";
}

export type NoResults = "clear-filters" | "search-all-fields" | "plain";

/** What the no-results page offers: loosen the filters first, then widen the Search Scope, else nothing. */
export function noResultsVariant(hasFilters: boolean, scopeNarrowed: boolean): NoResults {
  if (hasFilters) return "clear-filters";

  return scopeNarrowed ? "search-all-fields" : "plain";
}
