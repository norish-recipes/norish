import { eq, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import type { DbTransaction } from "@norish/db/drizzle";
import { categories, recipeCategories, recipes } from "@norish/db/schema";
import { BUILT_IN_CATEGORIES, resolveCategoryName } from "@norish/shared/lib/categories";
import { BUILT_IN_ALIASES } from "@norish/shared/lib/category-matcher";

import type { EntryWriteOptions } from "./list-entries";
import { listEntryNames, replaceRecipeEntriesByNameTx } from "./list-entries";

const link = alias(recipeCategories, "link");
const category = alias(categories, "category");

// A recipe's Category names in order, as a correlated subquery on `"recipes"`:
// the query using it must not alias the recipes table.
export const RECIPE_CATEGORY_NAMES_SQL = sql<string[]>`COALESCE(${new QueryBuilder()
  .select({ names: sql`array_agg(${category.name} ORDER BY ${link.order})` })
  .from(link)
  .innerJoin(category, eq(category.id, link.categoryId))
  .where(eq(link.recipeId, recipes.id))}, '{}')`;

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
 * Replaces a recipe's Categories with `names`, in that order, from its household's list. Imports
 * and AI map a name to a built-in through its aliases; an editor's save (`createEntries` false)
 * attaches only the entries it names, by fold, in the household's list or the instance's.
 */
export async function attachCategoriesToRecipeByInputTx(
  tx: DbTransaction,
  recipeId: string,
  names: readonly string[],
  options: EntryWriteOptions = {}
): Promise<number> {
  const resolved =
    options.createEntries === false
      ? names
      : names.map((name) => resolveCategoryName(name, BUILT_IN_ALIASES, []));

  return replaceRecipeEntriesByNameTx(tx, "category", recipeId, resolved, options);
}
