import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { Db } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import { ingredientAliases, ingredients, recipeIngredientFoods } from "@norish/db/schema";

import { lineageCte } from "./ingredient-kinds";

/**
 * What Ingredient Icons read and write in the catalogue: the tree of
 * Parent Ingredients with each food's own icon and Open Food Facts id, and
 * the one column an own icon lives in. Which icon a food shows is chosen by
 * `@norish/shared-server/ingredients/icons`, not here.
 */

/** An Ingredient as the icon walk reads it. */
export interface IconNode {
  id: string;
  name: string;
  parentId: string | null;
  offId: string | null;
  /** The own icon's file name, or null. */
  icon: string | null;
  /** Its household, null for a seeded food. */
  householdId: string | null;
}

/** These Ingredients and every ancestor of each, by id. */
export async function findIconLineage(ids: readonly string[]): Promise<Map<string, IconNode>> {
  const wanted = [...new Set(ids)];

  if (wanted.length === 0) return new Map();

  const lineage = lineageCte(wanted);
  const rows = await db
    .with(lineage)
    .selectDistinct({
      id: ingredients.id,
      name: ingredients.name,
      parentId: ingredients.parentId,
      offId: ingredients.offId,
      icon: ingredients.icon,
      householdId: ingredients.householdId,
    })
    .from(lineage)
    .innerJoin(ingredients, eq(ingredients.id, lineage.lineageId));

  return new Map(rows.map((row) => [row.id, row]));
}

/** Every Ingredient as the icon walk reads it: what the icon tool draws its set over. */
export async function listIconCatalogue(): Promise<Map<string, IconNode>> {
  const rows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      parentId: ingredients.parentId,
      offId: ingredients.offId,
      icon: ingredients.icon,
      householdId: ingredients.householdId,
    })
    .from(ingredients);

  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Set or clear an Ingredient's own icon; with `unlessSet`, only where it has
 * none, so a drawing that took a while never replaces one a person set
 * meanwhile. Whether a row was written.
 */
export async function setIngredientIcon(
  tx: Db,
  id: string,
  icon: string | null,
  { unlessSet = false }: { unlessSet?: boolean } = {}
): Promise<boolean> {
  const updated = await tx
    .update(ingredients)
    .set({ icon, version: sql`${ingredients.version} + 1` })
    .where(and(eq(ingredients.id, id), unlessSet ? isNull(ingredients.icon) : undefined))
    .returning({ id: ingredients.id });

  return updated.length > 0;
}

/** The icon files a household's own foods point at, read through the caller's transaction. */
export async function listHouseholdIconFiles(tx: Db, householdId: string): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ icon: ingredients.icon })
    .from(ingredients)
    .where(and(eq(ingredients.householdId, householdId), isNotNull(ingredients.icon)));

  return rows.flatMap((row) => (row.icon ? [row.icon] : []));
}

/** The file names every own icon points at: what the sweep keeps. */
export async function listIngredientIconFiles(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ icon: ingredients.icon })
    .from(ingredients)
    .where(isNotNull(ingredients.icon));

  return new Set(rows.flatMap((row) => (row.icon ? [row.icon] : [])));
}

/** How many recipe lines name each Ingredient, among their foods: which foods a reader meets most. */
export async function countRecipeUses(): Promise<Map<string, number>> {
  const rows = await db
    .select({ id: ingredientAliases.ingredientId, uses: sql<number>`count(*)::int` })
    .from(recipeIngredientFoods)
    .innerJoin(ingredientAliases, eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId))
    .groupBy(ingredientAliases.ingredientId);

  return new Map(rows.map((row) => [row.id, row.uses]));
}
