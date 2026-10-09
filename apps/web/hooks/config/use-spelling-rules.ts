"use client";

import { useMemo } from "react";

import type { SpellingRules } from "@norish/shared/lib/spelling-keys";
import { DEFAULT_INGREDIENT_WORDS, spellingRules } from "@norish/shared/lib/spelling-keys";

import { useIngredientWordsQuery } from "./use-ingredient-words-query";
import { useUnitsQuery } from "./use-units-query";

/**
 * How the resolver's first two rungs read a name, from the server's units
 * map and ingredient words: what a screen matches unresolved text on, so
 * "salt to taste" or "uien" typed here is the food the server will say it is.
 */
export function useSpellingRules(): SpellingRules {
  const { units } = useUnitsQuery();
  const { words } = useIngredientWordsQuery();

  return useMemo(() => spellingRules(units, words ?? DEFAULT_INGREDIENT_WORDS), [units, words]);
}
