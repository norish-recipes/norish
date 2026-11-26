import type { SQL } from "drizzle-orm";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { cookbookRecipes, ingredients, recipeIngredients, recipes } from "@norish/db/schema";

import { isAnyOf } from "./array-params";
import { lineFoodOutsideCatalogue, withLineFoods } from "./line-foods";
import { buildPolicyCondition } from "./recipes";

/** Which lines to look at, of the recipes the household may view: these, these recipes', a cookbook's, or all. */
export type LineScope =
  | { of: "lines"; ids: readonly string[] }
  | { of: "recipes"; ids: readonly string[] }
  | { of: "cookbook"; id: string }
  | { of: "visible" };

/** A recipe line's text as stored, for reading it again. */
export interface StoredLineText {
  id: string;
  recipeId: string;
  name: string;
  amount: string | null;
  unit: string | null;
}

function linesWithin(scope: LineScope): SQL | undefined {
  switch (scope.of) {
    case "lines":
      return isAnyOf(recipeIngredients.id, scope.ids, "uuid");
    case "recipes":
      return isAnyOf(recipeIngredients.recipeId, scope.ids, "uuid");
    case "cookbook":
      return inArray(
        recipeIngredients.recipeId,
        db
          .select({ id: cookbookRecipes.recipeId })
          .from(cookbookRecipes)
          .where(eq(cookbookRecipes.cookbookId, scope.id))
      );
    case "visible":
      return undefined;
  }
}

/**
 * The lines that name a spelling or food outside the household's catalogue (ADR-0042): another
 * household's recipe, or a leaver's still pointing at their old household's.
 */
export async function findLinesOutsideCatalogue(
  householdId: string,
  scope: LineScope
): Promise<StoredLineText[]> {
  if ((scope.of === "lines" || scope.of === "recipes") && scope.ids.length === 0) return [];

  const within = linesWithin(scope);
  const viewed = await buildPolicyCondition({ householdId }, recipes.householdId, "view");

  return await withLineFoods(
    db
      .selectDistinct({
        id: recipeIngredients.id,
        recipeId: recipeIngredients.recipeId,
        name: recipeIngredients.name,
        amount: recipeIngredients.amount,
        unit: recipeIngredients.unit,
      })
      .from(recipeIngredients)
      .$dynamic()
  )
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .where(and(lineFoodOutsideCatalogue(householdId), viewed, within));
}

/** Which of these foods the recipe's own lines name outside the household's catalogue. */
export async function findRecipeFoodsOutsideCatalogue(
  householdId: string,
  recipeId: string,
  ingredientIds: readonly string[]
): Promise<string[]> {
  if (ingredientIds.length === 0) return [];
  const rows = await withLineFoods(
    db.selectDistinct({ id: ingredients.id }).from(recipeIngredients).$dynamic()
  ).where(
    and(
      eq(recipeIngredients.recipeId, recipeId),
      isAnyOf(ingredients.id, ingredientIds, "uuid"),
      lineFoodOutsideCatalogue(householdId)
    )
  );

  return rows.map((row) => row.id);
}
