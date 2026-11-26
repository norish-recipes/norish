import { and, eq } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { ingredients, recipeIngredients, recipes } from "@norish/db/schema";

import { isAnyOf } from "./array-params";
import { lineFoodOutsideCatalogue, withLineFoods } from "./line-foods";
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
 * household's recipe, or a leaver's still pointing at their old household's.
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
    .where(and(lineFoodOutsideCatalogue(householdId), within));
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
