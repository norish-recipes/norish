"use client";

import { useQuery } from "@tanstack/react-query";

import type { RecipeForNutrition, WorkedOutNutrition } from "@norish/shared/lib/recipe-nutrition";
import {
  nutritionLinesOf,
  seasoningPhrases,
  suppliesNutrition,
  workOutNutrition,
} from "@norish/shared/lib/recipe-nutrition";

import { useSpellingRules, useUnitsQuery } from "../config";
import { useTRPC } from "../trpc";
import { useLineReadings } from "./use-line-readings";

/** Nutrition worked out from the lines, null where none is; `isLoading` while its inputs read. */
interface WorkedOutNutritionState {
  nutrition: WorkedOutNutrition | null;
  isLoading: boolean;
}

/**
 * Nutrition summed from a recipe's lines (ADR-0039) as the reader's household reads them; none if
 * it has its own, and loading while the readings or the foods' numbers read.
 */
export function useWorkedOutNutrition(
  recipe: (RecipeForNutrition & { id: string }) | null
): WorkedOutNutritionState {
  const trpc = useTRPC();
  const { units } = useUnitsQuery();
  const rules = useSpellingRules();
  const supplied = !recipe || suppliesNutrition(recipe);
  const readings = useLineReadings(supplied ? [] : [recipe.id]);
  const lines = recipe && !supplied ? nutritionLinesOf(recipe, readings) : [];
  const ingredientIds = [
    ...new Set((lines ?? []).flatMap((line) => (line.ingredientId ? [line.ingredientId] : []))),
  ].sort((a, b) => a.localeCompare(b));
  const { data, isLoading } = useQuery({
    ...trpc.ingredients.nutritionFor.queryOptions({ ingredientIds }),
    enabled: !supplied && ingredientIds.length > 0,
  });

  if (supplied || !recipe) return { nutrition: null, isLoading: false };
  if (!lines || (ingredientIds.length > 0 && !data)) {
    return { nutrition: null, isLoading: !lines || isLoading };
  }

  return {
    nutrition: workOutNutrition({
      lines,
      servings: recipe.servings,
      nutrition: new Map(Object.entries(data ?? {})),
      seasoning: seasoningPhrases(units),
      rules,
      estimate: recipe.nutritionEstimate ?? null,
    }),
    isLoading: false,
  };
}
