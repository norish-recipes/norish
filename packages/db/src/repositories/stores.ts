import type { IFuseOptions } from "fuse.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import Fuse from "fuse.js";
import z from "zod";

import type { DbTransaction } from "@norish/db/drizzle";
import type {
  AisleDto,
  IngredientStorePreferenceDto,
  StoreDto,
  StoreInsertDto,
  StoreUpdateDto,
} from "@norish/shared/contracts/dto/stores";
import { db } from "@norish/db/drizzle";
import { groceries, ingredients, ingredientStorePreferences, stores } from "@norish/db/schema";
import {
  IngredientStorePreferenceInsertSchema,
  IngredientStorePreferenceSelectSchema,
  StoreInsertBaseSchema,
  StoreSelectBaseSchema,
  StoreUpdateBaseSchema,
} from "@norish/shared/contracts/zod";

import { listAislesByStoreIds, saveStoreAisles } from "./aisles";

// Fuse.js configuration for ingredient name fuzzy matching
// threshold: 0 = exact match, 1 = match anything
// 0.4 is a good balance for ingredient names like "milk" matching "whole milk"
const FUZZY_THRESHOLD = 0.4;

const FUSE_OPTIONS: IFuseOptions<IngredientStorePreferenceDto & { ingredientName: string }> = {
  keys: ["ingredientName"],
  threshold: FUZZY_THRESHOLD,
  minMatchCharLength: 2,
  ignoreLocation: true,
  ignoreFieldNorm: true, // Critical for short strings like ingredient names
  includeScore: true,
  shouldSort: true,
};

/**
 * A Store travels with its aisles (ADR-0031): every row read here is handed
 * back with the Store's ordered aisle list attached, in one query for however
 * many Stores, before it is parsed as a Store.
 */
async function withAisles(
  rows: (typeof stores.$inferSelect)[],
  tx: typeof db | DbTransaction = db
): Promise<StoreDto[]> {
  const aisles = await listAislesByStoreIds(
    rows.map((row) => row.id),
    tx
  );
  const byStore = new Map<string, AisleDto[]>();

  for (const aisle of aisles) {
    byStore.set(aisle.storeId, [...(byStore.get(aisle.storeId) ?? []), aisle]);
  }
  const parsed = z
    .array(StoreSelectBaseSchema)
    .safeParse(rows.map((row) => ({ ...row, aisles: byStore.get(row.id) ?? [] })));

  if (!parsed.success) throw new Error("Failed to parse stores");

  return parsed.data;
}

export async function getStoreById(id: string): Promise<StoreDto | null> {
  const [row] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);

  if (!row) return null;
  const [store] = await withAisles([row]);

  return store ?? null;
}

export async function listStoresByUserIds(userIds: string[]): Promise<StoreDto[]> {
  if (!userIds.length) return [];

  const rows = await db
    .select()
    .from(stores)
    .where(inArray(stores.userId, userIds))
    .orderBy(stores.sortOrder);

  return withAisles(rows);
}

export async function checkStoreNameExistsInHousehold(
  name: string,
  userIds: string[],
  excludeStoreId?: string
): Promise<boolean> {
  if (!userIds.length) return false;

  const normalizedName = name.toLowerCase().trim();

  const conditions = [
    inArray(stores.userId, userIds),
    sql`LOWER(TRIM(${stores.name})) = ${normalizedName}`,
  ];

  if (excludeStoreId) {
    conditions.push(sql`${stores.id} != ${excludeStoreId}`);
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(stores)
    .where(and(...conditions));

  return (row?.count ?? 0) > 0;
}

export async function createStore(id: string, input: StoreInsertDto): Promise<StoreDto> {
  const parsed = StoreInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid StoreInsertDto");
  const { aisles, ...columns } = parsed.data;

  return await db.transaction(async (trx) => {
    // Get max sort order for user's stores
    const [maxOrder] = await trx
      .select({ max: sql<number>`COALESCE(MAX(${stores.sortOrder}), -1)` })
      .from(stores)
      .where(eq(stores.userId, input.userId));

    const sortOrder = (maxOrder?.max ?? -1) + 1;

    const [row] = await trx
      .insert(stores)
      .values({ id, ...columns, sortOrder })
      .returning();

    if (!row) throw new Error("Failed to create store");
    // A new Store can be made with its aisles in one go.
    if (aisles) await saveStoreAisles(row.id, aisles, trx);
    const [store] = await withAisles([row], trx);

    if (!store) throw new Error("Failed to parse created store");

    return store;
  });
}

export async function updateStore(input: StoreUpdateDto): Promise<StoreDto | null> {
  const parsed = StoreUpdateBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid StoreUpdateDto");
  const { aisles, ...columns } = parsed.data;

  const whereConditions = [eq(stores.id, input.id)];

  if (columns.version) {
    whereConditions.push(eq(stores.version, columns.version));
  }

  return await db.transaction(async (trx) => {
    const [row] = await trx
      .update(stores)
      .set({ ...columns, updatedAt: new Date(), version: sql`${stores.version} + 1` })
      .where(and(...whereConditions))
      .returning();

    if (!row) return null;
    // The aisles are saved with the Store, in the same write, so a stale
    // update that is ignored leaves them exactly as they were too.
    if (aisles !== undefined) await saveStoreAisles(row.id, aisles, trx);
    const [store] = await withAisles([row], trx);

    if (!store) throw new Error("Failed to parse updated store");

    return store;
  });
}

export async function reorderStores(
  storeUpdates: { id: string; version: number }[]
): Promise<StoreDto[]> {
  return await db.transaction(async (trx) => {
    const updatedRows: (typeof stores.$inferSelect)[] = [];

    for (let i = 0; i < storeUpdates.length; i++) {
      const storeUpdate = storeUpdates[i];

      if (!storeUpdate) continue;

      const [row] = await trx
        .update(stores)
        .set({ sortOrder: i, updatedAt: new Date(), version: sql`${stores.version} + 1` })
        .where(and(eq(stores.id, storeUpdate.id), eq(stores.version, storeUpdate.version)))
        .returning();

      if (row) updatedRows.push(row);
    }

    return withAisles(updatedRows, trx);
  });
}

export async function deleteStore(
  storeId: string,
  version: number,
  deleteGroceries: boolean,
  grocerySnapshot?: Array<{ id: string; version: number }>
): Promise<{ deletedGroceryIds: string[]; storeDeleted: boolean; stale: boolean }> {
  return await db.transaction(async (trx) => {
    let deletedGroceryIds: string[] = [];

    const [storeRow] = await trx
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.id, storeId), eq(stores.version, version)))
      .limit(1);

    if (!storeRow) {
      return { deletedGroceryIds, storeDeleted: false, stale: true };
    }

    if (grocerySnapshot && grocerySnapshot.length > 0) {
      if (deleteGroceries) {
        for (const grocery of grocerySnapshot) {
          const deleted = await trx
            .delete(groceries)
            .where(
              and(
                eq(groceries.id, grocery.id),
                eq(groceries.version, grocery.version),
                eq(groceries.storeId, storeId)
              )
            )
            .returning({ id: groceries.id });

          if (deleted.length > 0) {
            deletedGroceryIds.push(grocery.id);
          }
        }
      } else {
        for (const grocery of grocerySnapshot) {
          await trx
            .update(groceries)
            .set({ storeId: null, updatedAt: new Date(), version: sql`${groceries.version} + 1` })
            .where(
              and(
                eq(groceries.id, grocery.id),
                eq(groceries.version, grocery.version),
                eq(groceries.storeId, storeId)
              )
            );
        }
      }

      // Only delete store if it is empty after processing the snapshot
      const [remainingCount] = await trx
        .select({ count: sql<number>`count(*)` })
        .from(groceries)
        .where(eq(groceries.storeId, storeId));

      const isEmpty = (remainingCount?.count ?? 0) === 0;

      if (isEmpty) {
        // Delete ingredient preferences for this store
        await trx
          .delete(ingredientStorePreferences)
          .where(eq(ingredientStorePreferences.storeId, storeId));

        // Delete the store
        const deletedStore = await trx
          .delete(stores)
          .where(and(eq(stores.id, storeId), eq(stores.version, version)))
          .returning({ id: stores.id });

        if (deletedStore.length === 0) {
          return { deletedGroceryIds, storeDeleted: false, stale: true };
        }
      }

      return { deletedGroceryIds, storeDeleted: isEmpty, stale: false };
    }

    // Legacy path (no snapshot): process all current groceries
    if (deleteGroceries) {
      // Get grocery IDs before deleting
      const groceryRows = await trx
        .select({ id: groceries.id })
        .from(groceries)
        .where(eq(groceries.storeId, storeId));

      deletedGroceryIds = groceryRows.map((g) => g.id);

      // Delete groceries
      await trx.delete(groceries).where(eq(groceries.storeId, storeId));
    } else {
      // Set storeId to null for groceries in this store
      await trx
        .update(groceries)
        .set({ storeId: null, updatedAt: new Date(), version: sql`${groceries.version} + 1` })
        .where(eq(groceries.storeId, storeId));
    }

    // Delete ingredient preferences for this store
    await trx
      .delete(ingredientStorePreferences)
      .where(eq(ingredientStorePreferences.storeId, storeId));

    // Delete the store
    const deletedStore = await trx
      .delete(stores)
      .where(and(eq(stores.id, storeId), eq(stores.version, version)))
      .returning({ id: stores.id });

    if (deletedStore.length === 0) {
      return { deletedGroceryIds, storeDeleted: false, stale: true };
    }

    return { deletedGroceryIds, storeDeleted: true, stale: false };
  });
}

export async function getStoreOwnerId(storeId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: stores.userId })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  return row?.userId ?? null;
}

export async function countGroceriesInStore(storeId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(groceries)
    .where(eq(groceries.storeId, storeId));

  return row?.count ?? 0;
}

export async function getIngredientStorePreference(
  userId: string,
  ingredientId: string
): Promise<IngredientStorePreferenceDto | null> {
  const [row] = await db
    .select()
    .from(ingredientStorePreferences)
    .where(
      and(
        eq(ingredientStorePreferences.userId, userId),
        eq(ingredientStorePreferences.ingredientId, ingredientId)
      )
    )
    .limit(1);

  if (!row) return null;

  const parsed = IngredientStorePreferenceSelectSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse ingredient store preference");

  return parsed.data;
}

export async function listIngredientStorePreferences(
  userId: string
): Promise<IngredientStorePreferenceDto[]> {
  return listIngredientStorePreferencesForUsers([userId]);
}

/** A store preference with the name of the Ingredient it is for. */
type NamedPreference = IngredientStorePreferenceDto & { ingredientName: string };

/**
 * Get all ingredient store preferences for multiple users (household-level),
 * each with its Ingredient's name.
 */
async function listNamedPreferencesForUsers(userIds: string[]): Promise<NamedPreference[]> {
  if (!userIds.length) return [];

  const rows = await db
    .select({ preference: ingredientStorePreferences, ingredientName: ingredients.name })
    .from(ingredientStorePreferences)
    .innerJoin(ingredients, eq(ingredients.id, ingredientStorePreferences.ingredientId))
    .where(inArray(ingredientStorePreferences.userId, userIds));

  const parsed = z
    .array(IngredientStorePreferenceSelectSchema)
    .safeParse(rows.map((row) => row.preference));

  if (!parsed.success) throw new Error("Failed to parse ingredient store preferences");

  return parsed.data.map((preference, index) => ({
    ...preference,
    ingredientName: rows[index]!.ingredientName,
  }));
}

export async function listIngredientStorePreferencesForUsers(
  userIds: string[]
): Promise<IngredientStorePreferenceDto[]> {
  return (await listNamedPreferencesForUsers(userIds)).map(
    ({ ingredientName: _name, ...preference }) => preference
  );
}

/**
 * Remember the Store a member sends an Ingredient to. One per member and
 * Ingredient, so a preference for "milk" holds for "melk" (ADR-0037).
 */
export async function upsertIngredientStorePreference(
  userId: string,
  ingredientId: string,
  storeId: string
): Promise<IngredientStorePreferenceDto> {
  const input = { userId, ingredientId, storeId };
  const parsed = IngredientStorePreferenceInsertSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid IngredientStorePreferenceInsertDto");

  const [row] = await db
    .insert(ingredientStorePreferences)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: [ingredientStorePreferences.userId, ingredientStorePreferences.ingredientId],
      set: {
        storeId,
        updatedAt: new Date(),
        version: sql`${ingredientStorePreferences.version} + 1`,
      },
    })
    .returning();

  const validated = IngredientStorePreferenceSelectSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse upserted ingredient store preference");

  return validated.data;
}

export async function deleteIngredientStorePreference(
  userId: string,
  ingredientId: string
): Promise<void> {
  await db
    .delete(ingredientStorePreferences)
    .where(
      and(
        eq(ingredientStorePreferences.userId, userId),
        eq(ingredientStorePreferences.ingredientId, ingredientId)
      )
    );
}

/**
 * Result type for fuzzy preference matching
 */
export interface FuzzyPreferenceMatch {
  preference: IngredientStorePreferenceDto;
  score: number; // 0 = perfect match, higher = worse match
  isExactMatch: boolean;
  isCurrentUser: boolean;
}

/**
 * Find the Store a household sends an Ingredient to.
 *
 * Priority order:
 * 1. Current user's preference for the Ingredient
 * 2. Another household member's preference for the Ingredient
 * 3. Current user fuzzy match on the preferred Ingredients' names (best score)
 * 4. Other household member fuzzy match (best score)
 *
 * @param currentUserId - The ID of the user making the request
 * @param userIds - All household member IDs (including current user)
 * @param ingredient - The Ingredient the grocery resolved to, and its name as the list shows it
 * @returns The best matching preference or null if no match above threshold
 */
export async function findBestIngredientStorePreference(
  currentUserId: string,
  userIds: string[],
  ingredient: { id: string; name: string }
): Promise<FuzzyPreferenceMatch | null> {
  if (!userIds.length || !ingredient.name.trim()) return null;

  const allPreferences = await listNamedPreferencesForUsers(userIds);

  if (allPreferences.length === 0) return null;

  const strip = ({ ingredientName: _name, ...preference }: NamedPreference) => preference;

  // Step 1: the Ingredient itself, whatever it was called when it was preferred
  const currentUserExact = allPreferences.find(
    (p) => p.userId === currentUserId && p.ingredientId === ingredient.id
  );

  if (currentUserExact) {
    return {
      preference: strip(currentUserExact),
      score: 0,
      isExactMatch: true,
      isCurrentUser: true,
    };
  }

  const otherUserExact = allPreferences.find(
    (p) => p.userId !== currentUserId && p.ingredientId === ingredient.id
  );

  if (otherUserExact) {
    return {
      preference: strip(otherUserExact),
      score: 0,
      isExactMatch: true,
      isCurrentUser: false,
    };
  }

  // Step 2: No preference for the Ingredient, use fuzzy matching on names
  const fuse = new Fuse(allPreferences, FUSE_OPTIONS);
  const results = fuse.search(normalizePreferenceSearch(ingredient.name));

  if (results.length === 0) return null;

  // Separate results by current user vs others
  const currentUserMatches = results.filter((r) => r.item.userId === currentUserId);
  const otherUserMatches = results.filter((r) => r.item.userId !== currentUserId);

  // Prioritize current user's fuzzy match
  if (currentUserMatches.length > 0) {
    const best = currentUserMatches[0];

    if (!best) return null;

    return {
      preference: strip(best.item),
      score: best.score ?? 1,
      isExactMatch: false,
      isCurrentUser: true,
    };
  }

  // Fall back to best household member match
  if (otherUserMatches.length > 0) {
    const best = otherUserMatches[0];

    if (!best) return null;

    return {
      preference: strip(best.item),
      score: best.score ?? 1,
      isExactMatch: false,
      isCurrentUser: false,
    };
  }

  return null;
}

function normalizePreferenceSearch(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}
