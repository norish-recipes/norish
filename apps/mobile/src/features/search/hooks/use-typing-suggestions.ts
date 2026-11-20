import { useEffect, useState } from "react";

import { useLibraryList, useLibrarySuggestions } from "@norish/shared-react/recipes";

import {
  RECIPE_SUGGESTIONS,
  SUGGESTIONS_DEBOUNCE_MS,
  suggestionText,
} from "../utils/search-suggestions";
import { useSearchFilters } from "./use-search-filters";

/** The text once the reader has stopped typing for the debounce. */
function useSettled(text: string) {
  const [settled, setSettled] = useState(text);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), SUGGESTIONS_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text]);

  return settled;
}

/** What the typing state suggests for `text`: the top recipes of the results it would confirm to (the
 * same Search Scope, filters and sort) and the Ingredients, Tags and Categories to narrow to. */
export function useTypingSuggestions(text: string) {
  const filters = useSearchFilters();
  const asked = suggestionText(useSettled(text));
  const recipes = useLibraryList({
    sortBeatsRank: true,
    limit: RECIPE_SUGGESTIONS,
    filters: { ...filters, rawInput: asked },
    enabled: asked !== "",
  });
  const narrow = useLibrarySuggestions(asked);

  return {
    asked,
    // Still typing ahead of what was asked, or a read has not answered.
    loading: asked !== suggestionText(text) || recipes.isLoading || narrow.isLoading,
    recipes: asked === "" ? [] : recipes.recipes,
    narrow: asked === "" ? undefined : narrow.data,
  };
}
