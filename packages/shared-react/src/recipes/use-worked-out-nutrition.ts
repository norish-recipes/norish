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

/**
 * A recipe's worked-out nutrition for the reader's household (ADR-0039), from its lines as they
 * are and the server's nutrition per Ingredient. Null for a recipe that supplies its own, and
 * while the Ingredients' nutrition is still being read.
 */
export function useWorkedOutNutrition(
  recipe: RecipeForNutrition | null
): WorkedOutNutrition | null {
  const trpc = useTRPC();
  const { units } = useUnitsQuery();
  const rules = useSpellingRules();
  const supplied = !recipe || suppliesNutrition(recipe);
  const lines = recipe && !supplied ? nutritionLinesOf(recipe) : [];
  const ingredientIds = [
    ...new Set(lines.flatMap((line) => (line.ingredientId ? [line.ingredientId] : []))),
  ].sort((a, b) => a.localeCompare(b));
  const { data } = useQuery({
    ...trpc.ingredients.nutritionFor.queryOptions({ ingredientIds }),
    enabled: !supplied && ingredientIds.length > 0,
  });

  if (supplied || !recipe || (ingredientIds.length > 0 && !data)) return null;

  return workOutNutrition({
    lines,
    servings: recipe.servings,
    nutrition: new Map(Object.entries(data ?? {})),
    seasoning: seasoningPhrases(units),
    rules,
    estimate: recipe.nutritionEstimate ?? null,
  });
}
