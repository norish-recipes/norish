import { and, asc, desc, eq, gt, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import type { IngredientRef } from "@norish/db/repositories/ingredient-aliases";
import type { NamingRow, NamingRows } from "@norish/db/repositories/ingredient-cleanup";
import type { ParkedLinkRow } from "@norish/db/schema";
import { db } from "@norish/db/drizzle";
import {
  accounts,
  aisleLinks,
  aisles,
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
  storeProducts,
  stores,
  users,
} from "@norish/db/schema";
import { entryFold } from "@norish/shared/lib/fold-name";

import { assertOwnReferences } from "./household-rows";
import {
  findFoldedTwinTx,
  LIST_KINDS,
  listPendingFoldEntries,
  lockEntryFoldsTx,
  mergeEntryTx,
  setEntryFoldTx,
  takeOverHouseholdTwinsTx,
} from "./list-entries";

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

/** Clears the sign-in providers' tokens older releases stored; returns how many accounts held some. */
export async function clearStoredOAuthTokens(): Promise<number> {
  const cleared = await db
    .update(accounts)
    .set({ accessToken: null, refreshToken: null, idToken: null })
    .where(
      or(
        isNotNull(accounts.accessToken),
        isNotNull(accounts.refreshToken),
        isNotNull(accounts.idToken)
      )
    )
    .returning({ id: accounts.id });

  return cleared.length;
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
      householdId: recipes.householdId,
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
    .select({ id: groceries.id, name: groceries.name, householdId: groceries.householdId })
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
      householdId: recurringGroceries.householdId,
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

/** Pantry Ingredients from before 0.25, with their old Ingredient's name and their household. */
export async function listPantryIngredientsWithoutSpelling(): Promise<
  Array<{ id: string; name: string; householdId: string }>
> {
  return await db
    .select({
      id: pantryIngredients.id,
      name: ingredients.name,
      householdId: pantryIngredients.householdId,
    })
    .from(pantryIngredients)
    .innerJoin(ingredients, eq(ingredients.id, pantryIngredients.ingredientId))
    .where(isNull(pantryIngredients.ingredientAliasId));
}

/**
 * Point a Pantry Ingredient at its food. A household holding that food already held it twice, as
 * two names that fold alike, so the second row goes.
 */
export async function setPantryIngredientFood(id: string, food: IngredientRef): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ householdId: pantryIngredients.householdId })
      .from(pantryIngredients)
      .where(and(eq(pantryIngredients.id, id), isNull(pantryIngredients.ingredientAliasId)));

    if (!row) return;

    const [held] = await tx
      .select({ id: pantryIngredients.id })
      .from(pantryIngredients)
      .where(
        and(
          eq(pantryIngredients.householdId, row.householdId),
          eq(pantryIngredients.ingredientId, food.ingredientId),
          ne(pantryIngredients.id, id)
        )
      );

    if (held) await tx.delete(pantryIngredients).where(eq(pantryIngredients.id, id));
    else {
      await assertOwnReferences(
        row.householdId,
        { ingredientIds: [food.ingredientId], ingredientAliasIds: [food.aliasId] },
        tx
      );
      await tx
        .update(pantryIngredients)
        .set({ ingredientAliasId: food.aliasId, ingredientId: food.ingredientId })
        .where(eq(pantryIngredients.id, id));
    }
  });
}

/** Every grocery and recurring grocery name with the Ingredient it names, by household. */
export async function listGroceryNamesWithFood(): Promise<
  Array<{ householdId: string; name: string; ingredientId: string }>
> {
  const rows = await db
    .selectDistinct({
      householdId: groceries.householdId,
      name: groceries.name,
      ingredientId: groceries.ingredientId,
    })
    .from(groceries)
    .where(and(isNotNull(groceries.name), isNotNull(groceries.ingredientId)))
    .union(
      db
        .selectDistinct({
          householdId: recurringGroceries.householdId,
          name: recurringGroceries.name,
          ingredientId: recurringGroceries.ingredientId,
        })
        .from(recurringGroceries)
        .where(isNotNull(recurringGroceries.ingredientId))
    );

  return rows.flatMap(({ householdId, name, ingredientId }) =>
    name && ingredientId ? [{ householdId, name, ingredientId }] : []
  );
}

export interface ParkedLink {
  id: string;
  kind: "aisle" | "product" | "preference";
  link: ParkedLinkRow;
  /** Its Store's household, which resolves its name; null where the Store went. */
  householdId: string | null;
  /** The account a preference names, null where it is gone: then it was added by no one. */
  addedBy: string | null;
}

/** The parked links, newest first: the newest wins where two land on one food. */
export async function listParkedLinks(): Promise<ParkedLink[]> {
  return await db
    .select({
      id: parkedNameKeyedLinks.id,
      kind: parkedNameKeyedLinks.kind,
      link: parkedNameKeyedLinks.link,
      householdId: stores.householdId,
      addedBy: users.id,
    })
    .from(parkedNameKeyedLinks)
    .leftJoin(stores, eq(stores.id, sql`(${parkedNameKeyedLinks.link}->>'store_id')::uuid`))
    .leftJoin(users, eq(users.id, sql`${parkedNameKeyedLinks.link}->>'user_id'`))
    .orderBy(desc(sql`${parkedNameKeyedLinks.link}->>'updated_at'`));
}

/** What became of a parked link: put back, dropped, or dropped because its aisle or product went. */
export type Unparked = "restored" | "dropped" | "target-gone";

/**
 * Put a parked link back keyed by its food, unless its Store (or member) holds a newer one for that
 * food; a link naming no food (null) or a gone aisle or product is not put back. It leaves the parking.
 */
export async function unparkLink(
  parked: ParkedLink,
  ingredientId: string | null
): Promise<Unparked> {
  const { id, kind, link } = parked;

  return await db.transaction(async (tx) => {
    await tx.delete(parkedNameKeyedLinks).where(eq(parkedNameKeyedLinks.id, id));
    if (!ingredientId) return "dropped";

    const row = {
      id,
      storeId: link.store_id,
      ingredientId,
      createdAt: new Date(link.created_at),
      updatedAt: new Date(link.updated_at),
    };
    let put: Array<{ id: string }> = [];

    if (kind === "aisle" && link.aisle_id) {
      const [aisle] = await tx
        .select({ id: aisles.id })
        .from(aisles)
        .where(eq(aisles.id, link.aisle_id));

      if (!aisle) return "target-gone";
      put = await tx
        .insert(aisleLinks)
        .values({ ...row, aisleId: link.aisle_id })
        .onConflictDoNothing()
        .returning({ id: aisleLinks.id });
    } else if (kind === "product") {
      if (link.store_product_id) {
        const [product] = await tx
          .select({ id: storeProducts.id })
          .from(storeProducts)
          .where(eq(storeProducts.id, link.store_product_id));

        if (!product) return "target-gone";
      }
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
    } else if (kind === "preference" && parked.householdId) {
      put = await tx
        .insert(ingredientStorePreferences)
        .values({ ...row, householdId: parked.householdId, userId: parked.addedBy })
        .onConflictDoNothing()
        .returning({ id: ingredientStorePreferences.id });
    }

    return put.length > 0 ? "restored" : "dropped";
  });
}

/**
 * Folds the Tag, Cuisine and Category names migration 0092 could not fold exactly. Two entries of
 * one list folding alike merge: the older keeps its id, the other's recipes move onto it. Then a
 * household entry folding like an instance entry of its kind merges into that one (ADR-0043).
 */
export async function foldPendingListEntries(): Promise<number> {
  let folded = 0;

  for (const kind of LIST_KINDS) {
    folded += await db.transaction(async (tx) => {
      const pending = await listPendingFoldEntries(kind, tx);

      await lockEntryFoldsTx(
        tx,
        kind,
        pending.map((entry) => entryFold(entry.name))
      );

      for (const entry of pending) {
        const fold = entryFold(entry.name);
        const twin = await findFoldedTwinTx(tx, kind, entry.householdId, fold, entry.id);

        if (twin?.older) {
          await mergeEntryTx(tx, kind, [entry.id], twin.id);
          continue;
        }
        if (twin) await mergeEntryTx(tx, kind, [twin.id], entry.id);
        await setEntryFoldTx(tx, kind, entry.id, fold);
      }

      return pending.length + (await takeOverHouseholdTwinsTx(tx, kind));
    });
  }

  return folded;
}
