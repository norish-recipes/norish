import { and, asc, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";

import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import type { NamingRow, NamingRows } from "@norish/db/repositories/ingredient-cleanup";
import type { ParkedLinkRow } from "@norish/db/schema";
import { db } from "@norish/db/drizzle";
import {
  aisleLinks,
  groceries,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  parkedNameKeyedLinks,
  recipeImages,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
  recurringGroceries,
  storeProductLinks,
  stores,
} from "@norish/db/schema";

/** What the boot upgrades from older releases (startup/upgrades) read and write. */

export async function listGalleryImages(): Promise<
  Array<{ id: string; recipeId: string; image: string }>
> {
  return await db
    .select({ id: recipeImages.id, recipeId: recipeImages.recipeId, image: recipeImages.image })
    .from(recipeImages);
}

export async function updateGalleryImageUrl(imageId: string, image: string): Promise<void> {
  await db.update(recipeImages).set({ image }).where(eq(recipeImages.id, imageId));
}

/** Recipes with a picture and no Dish Colour. */
export async function listRecipeIdsWithoutDishColor(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: recipes.id })
    .from(recipes)
    .innerJoin(recipeImages, eq(recipeImages.recipeId, recipes.id))
    .where(isNull(recipes.dishColor));

  return rows.map((row) => row.id);
}

/** Recipe lines naming no food, after `afterId`: from before 0.25, or naming none today. */
export async function listLinesWithoutFood(
  limit: number,
  afterId: string | null
): Promise<NamingRows["lines"]> {
  return await db
    .select({
      id: recipeIngredients.id,
      name: recipeIngredients.name,
      amount: recipeIngredients.amount,
      unit: recipeIngredients.unit,
      ownerId: recipes.userId,
    })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
    .leftJoin(
      recipeIngredientFoods,
      eq(recipeIngredientFoods.recipeIngredientId, recipeIngredients.id)
    )
    .where(
      and(
        isNull(recipeIngredientFoods.recipeIngredientId),
        afterId ? gt(recipeIngredients.id, afterId) : undefined
      )
    )
    .orderBy(asc(recipeIngredients.id))
    .limit(limit);
}

/** Named groceries without a spelling, after `afterId`. */
export async function listGroceriesWithoutFood(
  limit: number,
  afterId: string | null
): Promise<NamingRow[]> {
  return await db
    .select({ id: groceries.id, name: groceries.name, ownerId: groceries.userId })
    .from(groceries)
    .where(
      and(
        isNull(groceries.ingredientAliasId),
        sql`trim(coalesce(${groceries.name}, '')) <> ''`,
        afterId ? gt(groceries.id, afterId) : undefined
      )
    )
    .orderBy(asc(groceries.id))
    .limit(limit);
}

export async function listRecurringGroceriesWithoutFood(
  limit: number,
  afterId: string | null
): Promise<NamingRow[]> {
  return await db
    .select({
      id: recurringGroceries.id,
      name: recurringGroceries.name,
      ownerId: recurringGroceries.userId,
    })
    .from(recurringGroceries)
    .where(
      and(
        isNull(recurringGroceries.ingredientAliasId),
        afterId ? gt(recurringGroceries.id, afterId) : undefined
      )
    )
    .orderBy(asc(recurringGroceries.id))
    .limit(limit);
}

/** Pantry Ingredients from before 0.25, with their old Ingredient's name. */
export async function listPantryIngredientsWithoutSpelling(): Promise<
  Array<{ id: string; name: string; ownerId: string }>
> {
  return await db
    .select({ id: pantryIngredients.id, name: ingredients.name, ownerId: pantryIngredients.userId })
    .from(pantryIngredients)
    .innerJoin(ingredients, eq(ingredients.id, pantryIngredients.ingredientId))
    .where(isNull(pantryIngredients.ingredientAliasId));
}

/**
 * Point a Pantry Ingredient at its food. A member holding that food already held it twice, as two
 * names that fold alike, so the second row goes.
 */
export async function setPantryIngredientFood(id: string, food: IngredientRef): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ userId: pantryIngredients.userId })
      .from(pantryIngredients)
      .where(and(eq(pantryIngredients.id, id), isNull(pantryIngredients.ingredientAliasId)));

    if (!row) return;

    const [held] = await tx
      .select({ id: pantryIngredients.id })
      .from(pantryIngredients)
      .where(
        and(
          eq(pantryIngredients.userId, row.userId),
          eq(pantryIngredients.ingredientId, food.ingredientId),
          sql`${pantryIngredients.id} <> ${id}`
        )
      );

    if (held) await tx.delete(pantryIngredients).where(eq(pantryIngredients.id, id));
    else {
      await tx
        .update(pantryIngredients)
        .set({ ingredientAliasId: food.aliasId, ingredientId: food.ingredientId })
        .where(eq(pantryIngredients.id, id));
    }
  });
}

/** Every grocery and recurring grocery name with the Ingredient it names. */
export async function listGroceryNamesWithFood(): Promise<
  Array<{ name: string; ingredientId: string }>
> {
  const rows = await db
    .selectDistinct({ name: groceries.name, ingredientId: groceries.ingredientId })
    .from(groceries)
    .where(and(isNotNull(groceries.name), isNotNull(groceries.ingredientId)))
    .union(
      db
        .selectDistinct({
          name: recurringGroceries.name,
          ingredientId: recurringGroceries.ingredientId,
        })
        .from(recurringGroceries)
        .where(isNotNull(recurringGroceries.ingredientId))
    );

  return rows.flatMap((row) =>
    row.name && row.ingredientId ? [{ name: row.name, ingredientId: row.ingredientId }] : []
  );
}

export interface ParkedLink {
  id: string;
  kind: "aisle" | "product" | "preference";
  link: ParkedLinkRow;
  /** The member it belongs to: a preference's, or its Store's owner; null where the Store went. */
  ownerId: string | null;
}

/** The parked links, newest first: the newest wins where two land on one food. */
export async function listParkedLinks(): Promise<ParkedLink[]> {
  const rows = await db
    .select({
      id: parkedNameKeyedLinks.id,
      kind: parkedNameKeyedLinks.kind,
      link: parkedNameKeyedLinks.link,
      storeOwnerId: stores.userId,
    })
    .from(parkedNameKeyedLinks)
    .leftJoin(stores, sql`${stores.id} = (${parkedNameKeyedLinks.link}->>'store_id')::uuid`)
    .orderBy(desc(sql`${parkedNameKeyedLinks.link}->>'updated_at'`));

  return rows.map(({ storeOwnerId, ...row }) => ({
    ...row,
    ownerId: storeOwnerId && (row.link.user_id ?? storeOwnerId),
  }));
}

/**
 * Put a parked link back keyed by its food, unless its Store (or member) holds a newer one for that
 * food; a link naming no food (null) is not put back. Either way it leaves the parking.
 */
export async function unparkLink(
  parked: ParkedLink,
  ingredientId: string | null
): Promise<boolean> {
  const { id, kind, link } = parked;

  return await db.transaction(async (tx) => {
    await tx.delete(parkedNameKeyedLinks).where(eq(parkedNameKeyedLinks.id, id));
    if (!ingredientId) return false;

    const row = {
      id,
      storeId: link.store_id,
      ingredientId,
      createdAt: new Date(link.created_at),
      updatedAt: new Date(link.updated_at),
    };
    let put: Array<{ id: string }> = [];

    if (kind === "aisle" && link.aisle_id) {
      put = await tx
        .insert(aisleLinks)
        .values({ ...row, aisleId: link.aisle_id })
        .onConflictDoNothing()
        .returning({ id: aisleLinks.id });
    } else if (kind === "product") {
      put = await tx
        .insert(storeProductLinks)
        .values({
          ...row,
          storeProductId: link.store_product_id ?? null,
          triedAt: link.tried_at ? new Date(link.tried_at) : null,
          suggestion: link.suggestion ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: storeProductLinks.id });
    } else if (kind === "preference" && link.user_id) {
      put = await tx
        .insert(ingredientStorePreferences)
        .values({ ...row, userId: link.user_id })
        .onConflictDoNothing()
        .returning({ id: ingredientStorePreferences.id });
    }

    return put.length > 0;
  });
}
