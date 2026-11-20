import type { CacheManager } from "@norish/shared-react/offline";
import type { SortOrder } from "@norish/shared/contracts";
import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { createLibraryFiltersStore } from "@norish/shared-react/recipes";
import { DEFAULT_RECIPE_FILTERS } from "@norish/shared/contracts/filter-contract";

import { createMark } from "./mark";

/** Best match is the server's `none`: rank while there is text, newest otherwise. It is Search's default. */
export const BEST_MATCH: SortOrder = "none";

/** What a fresh Search holds: recipes only, ranked by Best match, Title and Ingredients. */
export const SEARCH_START: CanonicalRecipeFilters = {
  ...DEFAULT_RECIPE_FILTERS,
  sortMode: BEST_MATCH,
  libraryType: "recipes",
};

// The tRPC provider remounts the tree when the session settles, so Search's filters live out here.
// Clear filters leaves the text, scope and sort: they are the field's, not chips.
export const searchStore = createLibraryFiltersStore(SEARCH_START);

searchStore.setState({ keepOnClear: ["rawInput", "searchFields", "sortMode"] });

/** Whether Search's text was confirmed with the search key; it outlives the provider with the filters. */
const confirmed = createMark(false);

export const setSearchConfirmed = confirmed.set;
export const getSearchConfirmed = confirmed.get;
export const useSearchConfirmed = confirmed.use;

/** A new session starts Search over. */
export function resetSearchSession() {
  searchStore.setState({ filters: SEARCH_START });
  setSearchConfirmed(false);
}

/** Starts Search over the moment its account changes: a switch, sign-out or Session Expiry. A wipe
 * reopens the same account's data, so the session stays. */
export function followSearchOwner(ownerData: CacheManager["ownerData"]): () => void {
  let sessionOwner = ownerData.owner();

  return ownerData.subscribe(() => {
    const owner = ownerData.owner() ?? ownerData.next();

    if (owner === sessionOwner) return;
    if (sessionOwner !== null) resetSearchSession();
    sessionOwner = owner;
  });
}
