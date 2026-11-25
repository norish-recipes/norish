import { eq, sql } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import { categories, recipeCategories } from "@norish/db/schema";
import { BUILT_IN_CATEGORIES, resolveCategoryName } from "@norish/shared/lib/categories";
import { BUILT_IN_ALIASES } from "@norish/shared/lib/category-matcher";

import { listEntryNames, replaceRecipeEntriesByNameTx } from "./list-entries";

// A recipe's Category names in order, as a correlated subquery on `"recipes"`:
// the query using it must not alias the recipes table.
export const RECIPE_CATEGORY_NAMES_SQL = sql<string[]>`COALESCE((
  SELECT array_agg(category.name ORDER BY link."order") FROM ${recipeCategories} AS link
  INNER JOIN ${categories} AS category ON category.id = link.category_id
  WHERE link.recipe_id = "recipes"."id"
), '{}')`;

/** The Categories a household is offered: the built-ins in their order, then its own (ADR-0040). */
export async function listCategoryNamesForHousehold(householdId: string): Promise<string[]> {
  const rank = (name: string) => {
    const builtIn = (BUILT_IN_CATEGORIES as readonly string[]).indexOf(name);

    return builtIn === -1 ? BUILT_IN_CATEGORIES.length : builtIn;
  };
  // Array sort is stable, so the household's own keep their name order.
  return (await listEntryNames("category", householdId)).sort((a, b) => rank(a) - rank(b));
}

export async function recipeHasCategoriesTx(tx: DbTransaction, recipeId: string): Promise<boolean> {
  const [row] = await tx
    .select({ recipeId: recipeCategories.recipeId })
    .from(recipeCategories)
    .where(eq(recipeCategories.recipeId, recipeId))
    .limit(1);

  return row !== undefined;
}

/**
 * Replaces a recipe's Categories with `names`, in that order, from its household's list. A name
 * resolves to a built-in through its aliases, else to the household's entry of that fold.
 */
export async function attachCategoriesToRecipeByInputTx(
  tx: DbTransaction,
  recipeId: string,
  names: readonly string[]
): Promise<void> {
  const resolved = names.map((name) => resolveCategoryName(name, BUILT_IN_ALIASES, []));

  await replaceRecipeEntriesByNameTx(tx, "category", recipeId, resolved);
}
