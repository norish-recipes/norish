"use client";

import { useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useSpellingRules } from "@/hooks/config/use-spelling-rules";
import { useUnitsQuery } from "@/hooks/config/use-units-query";
import { useQuery } from "@tanstack/react-query";

import type {
  NutritionGapEstimate,
  RecipeForNutrition,
  WorkedOutNutrition,
} from "@norish/shared/lib/recipe-nutrition";
import {
  nutritionLinesOf,
  seasoningPhrases,
  suppliesNutrition,
  workOutNutrition,
} from "@norish/shared/lib/recipe-nutrition";

/**
 * A recipe's worked-out nutrition for the reader's household (ADR-0039):
 * the server answers what each of its Ingredients is, for this household,
 * and the total is worked out here from the recipe's lines as they are, so
 * an edit to an amount moves it at once. The language model's stored share
 * of the lines left out is added while it still covers exactly those lines.
 * Null for a recipe that supplies Nutrition Information of its own, which
 * always wins, and while the Ingredients' nutrition is still being read.
 */
export function useWorkedOutNutrition(
  recipe: RecipeForNutrition | null
): WorkedOutNutrition | null {
  const trpc = useTRPC();
  const { units } = useUnitsQuery();
  const rules = useSpellingRules();
  const supplied = !recipe || suppliesNutrition(recipe);
  const lines = useMemo(
    () => (recipe && !supplied ? nutritionLinesOf(recipe) : []),
    [recipe, supplied]
  );
  const ingredientIds = useMemo(
    () =>
      [...new Set(lines.flatMap((line) => (line.ingredientId ? [line.ingredientId] : [])))].sort(),
    [lines]
  );
  const { data } = useQuery({
    ...trpc.ingredients.nutritionFor.queryOptions({ ingredientIds }),
    enabled: !supplied && ingredientIds.length > 0,
  });
  const seasoning = useMemo(() => seasoningPhrases(units), [units]);

  return useMemo(() => {
    if (supplied || !recipe || (ingredientIds.length > 0 && !data)) return null;

    return workOutNutrition({
      lines,
      servings: recipe.servings,
      nutrition: new Map(Object.entries(data ?? {})),
      seasoning,
      rules,
      estimate: recipe.nutritionEstimate ?? null,
    });
  }, [supplied, recipe, ingredientIds.length, data, lines, seasoning, rules]);
}
