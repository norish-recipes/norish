import { useConnectivity } from "@norish/shared-react/offline/react";
import { useLibraryList, useLibrarySuggestions } from "@norish/shared-react/recipes";
import { useSettledText } from "@norish/shared-react/settled-text";

import {
  RECIPE_SUGGESTIONS,
  SUGGESTIONS_DEBOUNCE_MS,
  suggestionText,
} from "../utils/search-suggestions";
import { useSearchFilters } from "./use-search-filters";

/** What the typing state suggests for `text`: the top recipes of the results it would confirm to (the
 * same Search Scope, filters and sort) and the Ingredients, Tags and Categories to narrow to. Nothing
 * is read unless `typing`: the state shows, and none is asked or shown Offline. */
export function useTypingSuggestions(text: string, typing: boolean) {
  const filters = useSearchFilters();
  const { isOffline } = useConnectivity();
  const settled = useSettledText(text, SUGGESTIONS_DEBOUNCE_MS);
  // Offline nothing is asked, so there is no read, no skeleton and no row.
  const asked = isOffline ? "" : suggestionText(settled);
  const wanted = isOffline ? "" : suggestionText(text);
  const recipes = useLibraryList({
    sortBeatsRank: true,
    limit: RECIPE_SUGGESTIONS,
    filters: { ...filters, rawInput: asked },
    enabled: typing && asked !== "",
  });
  const narrow = useLibrarySuggestions(asked, typing);

  return {
    asked,
    // Still typing ahead of what was asked, or a read has not answered.
    loading: asked !== wanted || recipes.isLoading || narrow.isLoading,
    recipes: asked === "" ? [] : recipes.recipes,
    narrow: asked === "" ? undefined : narrow.data,
  };
}
