import { and, eq, or } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import {
  ingredientAliases,
  ingredients,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
} from "@norish/db/schema";

import { isAnyOf } from "./array-params";
import { outsideCatalogue } from "./household-scope";
import { buildPolicyCondition } from "./recipes";

/** Which lines to look at: these, these recipes', or every recipe's the household may view. */
export type LineScope =
  { lineIds: readonly string[] } | { recipeIds: readonly string[] } | "visible";

/** A recipe line's text as stored, for reading it again. */
export interface StoredLineText {
  id: string;
  recipeId: string;
  name: string;
  amount: string | null;
  unit: string | null;
}

/**
 * The lines that name a spelling or food outside the household's catalogue (ADR-0042): another
 * household's recipe, or a leaver's still pointing at their old household's. The one test of it.
 */
export async function findLinesOutsideCatalogue(
  householdId: string,
  scope: LineScope
): Promise<StoredLineText[]> {
  if (scope !== "visible" && Object.values(scope)[0]!.length === 0) return [];

  const within =
    scope === "visible"
      ? await buildPolicyCondition({ householdId }, recipes.householdId, "view")
      : "lineIds" in scope
        ? isAnyOf(recipeIngredients.id, scope.lineIds, "uuid")
        : isAnyOf(recipeIngredients.recipeId, scope.recipeIds, "uuid");

  return await db
    .selectDistinct({
      id: recipeIngredients.id,
      recipeId: recipeIngredients.recipeId,
      name: recipeIngredients.name,
      amount: recipeIngredients.amount,
      unit: recipeIngredients.unit,
    })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .innerJoin(
      recipeIngredientFoods,
      eq(recipeIngredientFoods.recipeIngredientId, recipeIngredients.id)
    )
    .innerJoin(ingredientAliases, eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId))
    .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
    .where(
      and(
        or(
          outsideCatalogue(ingredientAliases.householdId, householdId),
          outsideCatalogue(ingredients.householdId, householdId)
        ),
        within
      )
    );
}
