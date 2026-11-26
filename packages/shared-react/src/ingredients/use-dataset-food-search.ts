"use client";

import { useEffect, useState } from "react";

import { NUTRITION_CREDIT_NAMES } from "@norish/shared/contracts/ingredient-nutrition";

import type { NutritionFactName } from "./use-nutrition-draft";
import { useNutritionFoodsQuery } from "./use-ingredient-nutrition";

/** How long typing pauses before the datasets are searched. */
const SEARCH_DELAY_MS = 250;

/**
 * Finds a dataset food by the words of its name, in the dataset's own words, from two letters on.
 * For a piece weight or a density only foods with one are offered; `value` is what the fact would be.
 */
export function useDatasetFoodSearch(fact: NutritionFactName, term: string) {
  const typed = term.trim();
  const [search, setSearch] = useState(typed);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed), SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [typed]);

  const { foods, isFetching } = useNutritionFoodsQuery(search.length >= 2 ? search : null);
  const options = foods
    .filter((food) =>
      fact === "pieceWeight"
        ? food.pieceWeight !== null
        : fact === "density"
          ? food.density !== null
          : true
    )
    .map((food) => ({
      id: `${food.dataset}:${food.code}`,
      name: food.name,
      kcal: food.kcal,
      pieceWeight: food.pieceWeight,
      density: food.density,
      dataset: NUTRITION_CREDIT_NAMES[food.dataset],
    }));

  return {
    options,
    hint:
      options.length > 0
        ? null
        : typed.length < 2
          ? ("hint" as const)
          : isFetching || search !== typed
            ? ("searching" as const)
            : ("empty" as const),
  };
}
