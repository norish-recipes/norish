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
 * is read unless `typing`: the state shows, and none is shown Offline. */
export function useTypingSuggestions(text: string, typing: boolean, offline: boolean) {
  const filters = useSearchFilters();
  const asked = suggestionText(useSettledText(text, SUGGESTIONS_DEBOUNCE_MS));
  const recipes = useLibraryList({
    sortBeatsRank: true,
    limit: RECIPE_SUGGESTIONS,
    filters: { ...filters, rawInput: asked },
    enabled: typing && !offline && asked !== "",
  });
  const narrow = useLibrarySuggestions(asked, typing && !offline);

  return {
    asked,
    // Still typing ahead of what was asked, or a read has not answered.
    loading: !offline && (asked !== suggestionText(text) || recipes.isLoading || narrow.isLoading),
    recipes: asked === "" || offline ? [] : recipes.recipes,
    narrow: asked === "" || offline ? undefined : narrow.data,
  };
}
