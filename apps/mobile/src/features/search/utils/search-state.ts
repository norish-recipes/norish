import { hasSearchText } from "@norish/shared/lib/search-terms";

/** Which page of Search shows. */
export type SearchView =
  "rested" | "focused" | "typing" | "results" | "none" | "offline" | "failed";

/** What the choice reads: `resultCount` is null while the search is loading. */
export type SearchViewInput = {
  text: string;
  /** The search key was used since the text last changed. */
  confirmed: boolean;
  /** At least one filter chip is applied. */
  hasChips: boolean;
  focused: boolean;
  resultCount: number | null;
  /** The app is Offline: the backend cannot be reached. */
  offline: boolean;
  /** Results for exactly this search are held: loaded Live earlier, or from the Offline Cache. */
  held: boolean;
  /** The read failed (after its retry); with nothing held it never counts as an empty answer. */
  failed: boolean;
};

/** Results show for a confirmed text, or while a chip filters an empty one; no text and no chips rests. */
export const showsResults = ({
  text,
  confirmed,
  hasChips,
}: Pick<SearchViewInput, "text" | "confirmed" | "hasChips">) =>
  hasSearchText(text) ? confirmed : hasChips;

/** With nothing held, Offline says it needs a connection and a failed read says it failed; neither is "none". */
export function searchView(input: SearchViewInput): SearchView {
  if (showsResults(input)) {
    if (!input.held) {
      if (input.offline) return "offline";
      if (input.failed) return "failed";
    }

    return input.resultCount === 0 ? "none" : "results";
  }
  if (hasSearchText(input.text)) return "typing";

  return input.focused ? "focused" : "rested";
}

/** The Search Scope shows while the field is focused, and stays while it holds text with the keyboard
 * down (Results); the rested page, with no focus and no text, has none. */
export const showsScope = (focused: boolean, text: string) => focused || hasSearchText(text);

export type NoResults = "clear-filters" | "search-all-fields" | "plain";

/** What the no-results page offers: loosen the filters first, then widen the Search Scope, else nothing. */
export function noResultsVariant(hasFilters: boolean, scopeNarrowed: boolean): NoResults {
  if (hasFilters) return "clear-filters";

  return scopeNarrowed ? "search-all-fields" : "plain";
}
