import { useEffect, useState } from "react";

import type { IngredientItem } from "./types";
import { useConnectivity } from "../offline/react";
import { useIngredientSearchQuery } from "./use-ingredient-query";

/** How long typing pauses before the catalogue is searched, as in the ingredient picker. */
const SEARCH_DELAY_MS = 250;
/** The catalogue is searched from this many characters on. */
const SEARCH_MIN_LENGTH = 2;
/** How many catalogue foods are offered below the kept ones. */
const CATALOGUE_MATCHES = 8;

/** The catalogue foods the field's text finds that the household does not keep: none offline, and
 * none until the answer is for the text now in the field, `searching` till then. */
export function usePantryCatalogue(
  typed: string,
  locale: string,
  keptIngredientIds: ReadonlySet<string>
): { matches: IngredientItem[]; searching: boolean } {
  const { isOffline } = useConnectivity();
  const [search, setSearch] = useState(typed);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [typed]);

  const { items, isLoading } = useIngredientSearchQuery(
    !isOffline && search.length >= SEARCH_MIN_LENGTH ? search : null,
    locale,
    { listedOnly: false }
  );

  const asked = !isOffline && typed.length >= SEARCH_MIN_LENGTH;
  const answered = asked && search === typed && !isLoading;

  return {
    matches: answered
      ? items.filter((food) => !keptIngredientIds.has(food.id)).slice(0, CATALOGUE_MATCHES)
      : [],
    searching: asked && !answered,
  };
}
