import { useConnectivity } from "@norish/shared-react/offline/react";
import { useLibraryList } from "@norish/shared-react/recipes";

import type { SearchView } from "../utils/search-state";
import { searchView, showsResults } from "../utils/search-state";
import { useSearchFilters } from "./use-search-filters";

/** The Library list a confirmed search reads and the page the state rule picks for it. */
export function useSearchResults(input: {
  text: string;
  confirmed: boolean;
  hasChips: boolean;
  focused: boolean;
}): { list: ReturnType<typeof useLibraryList>; view: SearchView; loading: boolean } {
  const filters = useSearchFilters();
  const { isOffline } = useConnectivity();
  // Recipes only, and an explicit sort beats rank; nothing is read until Results show. A read
  // left running or failed Offline is read again by Recovery, so the query is never toggled.
  const list = useLibraryList({
    sortBeatsRank: true,
    withMatch: true,
    filters,
    enabled: showsResults(input),
  });
  const view = searchView({
    ...input,
    offline: isOffline,
    held: list.held,
    failed: list.error != null,
    resultCount: list.isLoading ? null : list.recipes.length,
  });

  return { list, view, loading: view !== "offline" && view !== "failed" && list.isLoading };
}
