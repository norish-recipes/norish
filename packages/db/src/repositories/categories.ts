import type { SQL } from "drizzle-orm";
import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import { categories, recipeCategories, recipes } from "@norish/db/schema";
import {
  BUILT_IN_CATEGORIES,
  isBuiltInCategory,
  resolveCategoryName,
} from "@norish/shared/lib/categories";
import { BUILT_IN_ALIASES } from "@norish/shared/lib/category-matcher";

/**
 * A recipe's Category names in order, as a correlated subquery. Like
 * PRIMARY_IMAGE_SQL it names the outer table `"recipes"` by hand, so the
 * query using it must not alias the recipes table.
 */
export const RECIPE_CATEGORY_NAMES_SQL = sql<string[]>`COALESCE((
  SELECT array_agg(category.name ORDER BY link."order") FROM ${recipeCategories} AS link
  INNER JOIN ${categories} AS category ON category.id = link.category_id
  WHERE link.recipe_id = "recipes"."id"
), '{}')`;

/** Recipes carrying any of `names`, compared case-insensitively. */
export function recipeInAnyCategorySql(names: readonly string[]): SQL {
  const lowers = names.map((name) => name.toLowerCase());

  return sql`EXISTS (
    SELECT 1 FROM ${recipeCategories} AS link
    INNER JOIN ${categories} AS category ON category.id = link.category_id
    WHERE link.recipe_id = "recipes"."id" AND ${inArray(sql`lower(category.name)`, lowers)}
  )`;
}

/**
 * The Categories a household is offered: the built-ins, then every other
 * Category on a recipe owned by one of `userIds` (ADR-0040).
 */
export async function listCategoryNamesForUsers(userIds: string[]): Promise<string[]> {
  if (!userIds.length) return [...BUILT_IN_CATEGORIES];

  const lowerName = sql<string>`lower(${categories.name})`.as("lower_name");
  const rows = await db
    .selectDistinct({ name: categories.name, lowerName })
    .from(categories)
    .innerJoin(recipeCategories, eq(categories.id, recipeCategories.categoryId))
    .innerJoin(recipes, eq(recipeCategories.recipeId, recipes.id))
    .where(inArray(recipes.userId, userIds))
    .orderBy(lowerName);

  return [...BUILT_IN_CATEGORIES, ...rows.map((r) => r.name).filter((n) => !isBuiltInCategory(n))];
}

/**
 * Category row ids for `names`, created when missing. A name resolves to a
 * built-in only on an exact match, then to an existing row by case.
 */
async function getOrCreateCategoryIdsTx(
  tx: DbTransaction,
  names: readonly string[]
): Promise<string[]> {
  const resolved = new Map<string, string>();

  for (const name of names) {
    const canonical = resolveCategoryName(name, BUILT_IN_ALIASES, []);

    if (canonical && !resolved.has(canonical.toLowerCase()))
      resolved.set(canonical.toLowerCase(), canonical);
  }

  if (resolved.size === 0) return [];

  await tx
    .insert(categories)
    .values([...resolved.values()].map((name) => ({ name })))
    .onConflictDoNothing();

  const rows = await tx
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(inArray(sql`lower(${categories.name})`, [...resolved.keys()]));
  const idByLower = new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));

  return [...resolved.keys()].flatMap((lower) => idByLower.get(lower) ?? []);
}

export async function recipeHasCategoriesTx(tx: DbTransaction, recipeId: string): Promise<boolean> {
  const [row] = await tx
    .select({ recipeId: recipeCategories.recipeId })
    .from(recipeCategories)
    .where(eq(recipeCategories.recipeId, recipeId))
    .limit(1);

  return row !== undefined;
}

/** Deletes Categories no recipe carries, except the built-ins. */
export async function deleteOrphanedCategoriesTx(tx: DbTransaction): Promise<void> {
  const orphanedIds = await tx
    .select({ id: categories.id })
    .from(categories)
    .leftJoin(recipeCategories, eq(categories.id, recipeCategories.categoryId))
    .where(
      and(
        isNull(recipeCategories.categoryId),
        notInArray(categories.name, [...BUILT_IN_CATEGORIES])
      )
    )
    .then((rows) => rows.map((r) => r.id));

  if (orphanedIds.length === 0) return;

  await tx.delete(categories).where(inArray(categories.id, orphanedIds));
}

/** Replaces a recipe's Categories with `names`, in that order. */
export async function attachCategoriesToRecipeByInputTx(
  tx: DbTransaction,
  recipeId: string,
  names: readonly string[]
): Promise<void> {
  await tx.delete(recipeCategories).where(eq(recipeCategories.recipeId, recipeId));

  const ids = await getOrCreateCategoryIdsTx(tx, names);

  if (ids.length > 0) {
    await tx
      .insert(recipeCategories)
      .values(ids.map((categoryId, order) => ({ recipeId, categoryId, order })));
  }

  await deleteOrphanedCategoriesTx(tx);
}
