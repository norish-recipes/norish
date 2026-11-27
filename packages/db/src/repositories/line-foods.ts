import type { PgSelect } from "drizzle-orm/pg-core";
import { eq, or } from "drizzle-orm";

import {
  ingredientAliases,
  ingredients,
  recipeIngredientFoods,
  recipeIngredients,
} from "@norish/db/schema";

import { outsideCatalogue } from "./household-scope";

/** A select over recipe lines joined to each food a line names: its spelling and that Ingredient. */
export function withLineFoods<T extends PgSelect>(query: T) {
  return query
    .innerJoin(
      recipeIngredientFoods,
      eq(recipeIngredientFoods.recipeIngredientId, recipeIngredients.id)
    )
    .innerJoin(ingredientAliases, eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId))
    .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId));
}

/**
 * A line food (`withLineFoods`) outside the household's catalogue (ADR-0042): its spelling or its
 * food is another household's. The one test of it.
 */
export function lineFoodOutsideCatalogue(householdId: string) {
  return or(
    outsideCatalogue(ingredientAliases.householdId, householdId),
    outsideCatalogue(ingredients.householdId, householdId)
  )!;
}
