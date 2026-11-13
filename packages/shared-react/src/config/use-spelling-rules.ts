import { useMemo } from "react";

import type { SpellingRules } from "@norish/shared/lib/spelling-keys";
import { DEFAULT_INGREDIENT_WORDS, spellingRules } from "@norish/shared/lib/spelling-keys";

import { useIngredientWordsQuery } from "./use-ingredient-words-query";
import { useUnitsQuery } from "./use-units-query";

/**
 * The resolver's first two rungs from the server's units and ingredient words, so text typed here
 * matches the food the server will resolve it to.
 */
export function useSpellingRules(): SpellingRules {
  const { units } = useUnitsQuery();
  const { words } = useIngredientWordsQuery();

  return useMemo(() => spellingRules(units, words ?? DEFAULT_INGREDIENT_WORDS), [units, words]);
}
