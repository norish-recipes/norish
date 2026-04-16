import type { IFuseOptions } from "fuse.js";
import { and, eq, inArray, sql } from "drizzle-orm";
import Fuse from "fuse.js";
import z from "zod";

import type {
  IngredientStorePreferenceDto,
  StoreDto,
  StoreInsertDto,
  StoreUpdateDto,
} from "@norish/shared/contracts/dto/stores";
import { db } from "@norish/db/drizzle";
import { groceries, ingredientStorePreferences, stores } from "@norish/db/schema";
import {
  IngredientStorePreferenceInsertSchema,
  IngredientStorePreferenceSelectSchema,
  StoreInsertBaseSchema,
  StoreSelectBaseSchema,
  StoreUpdateBaseSchema,
} from "@norish/shared/contracts/zod";

// Fuse.js configuration for ingredient name fuzzy matching
// threshold: 0 = exact match, 1 = match anything
// 0.4 is a good balance for ingredient names like "milk" matching "whole milk"
const FUZZY_THRESHOLD = 0.4;

const FUSE_OPTIONS: IFuseOptions<IngredientStorePreferenceDto> = {
  keys: ["normalizedName"],
  threshold: FUZZY_THRESHOLD,
  minMatchCharLength: 2,
  ignoreLocation: true,
  ignoreFieldNorm: true, // Critical for short strings like ingredient names
  includeScore: true,
  shouldSort: true,
};

export async function getStoreById(id: string): Promise<StoreDto | null> {
  const [row] = await db.select().from(stores).where(eq(stores.id, id)).limit(1);

  if (!row) return null;

  const parsed = StoreSelectBaseSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse store by id");

  return parsed.data;
}

export async function listStoresByUserIds(userIds: string[]): Promise<StoreDto[]> {
  if (!userIds.length) return [];

  const rows = await db
    .select()
    .from(stores)
    .where(inArray(stores.userId, userIds))
    .orderBy(stores.sortOrder);

  const parsed = z.array(StoreSelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse stores");

  return parsed.data;
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

  // Get max sort order for user's stores
  const [maxOrder] = await db
    .select({ max: sql<number>`COALESCE(MAX(${stores.sortOrder}), -1)` })
    .from(stores)
    .where(eq(stores.userId, input.userId));

  const sortOrder = (maxOrder?.max ?? -1) + 1;

  const [row] = await db
    .insert(stores)
    .values({ id, ...parsed.data, sortOrder })
    .returning();

  const validated = StoreSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse created store");

  return validated.data;
}

export async function updateStore(input: StoreUpdateDto): Promise<StoreDto | null> {
  const parsed = StoreUpdateBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid StoreUpdateDto");

  const whereConditions = [eq(stores.id, input.id)];

  if (parsed.data.version) {
    whereConditions.push(eq(stores.version, parsed.data.version));
  }

  const [row] = await db
    .update(stores)
    .set({ ...parsed.data, updatedAt: new Date(), version: sql`${stores.version} + 1` })
    .where(and(...whereConditions))
    .returning();

  if (!row) return null;

  const validated = StoreSelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse updated store");

  return validated.data;
}

export async function reorderStores(
  storeUpdates: { id: string; version: number }[]
): Promise<StoreDto[]> {
  return await db.transaction(async (trx) => {
    const updatedStores: StoreDto[] = [];

    for (let i = 0; i < storeUpdates.length; i++) {
      const storeUpdate = storeUpdates[i];

      if (!storeUpdate) continue;

      const [row] = await trx
        .update(stores)
        .set({ sortOrder: i, updatedAt: new Date(), version: sql`${stores.version} + 1` })
        .where(and(eq(stores.id, storeUpdate.id), eq(stores.version, storeUpdate.version)))
        .returning();

      if (row) {
        const validated = StoreSelectBaseSchema.safeParse(row);

        if (!validated.success)
          throw new Error(`Failed to parse reordered store (id=${storeUpdate.id})`);
        updatedStores.push(validated.data);
      }
    }

    return updatedStores;
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
  normalizedName: string
): Promise<IngredientStorePreferenceDto | null> {
  const [row] = await db
    .select()
    .from(ingredientStorePreferences)
    .where(
      and(
        eq(ingredientStorePreferences.userId, userId),
        eq(ingredientStorePreferences.normalizedName, normalizedName)
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
  const rows = await db
    .select()
    .from(ingredientStorePreferences)
    .where(eq(ingredientStorePreferences.userId, userId));

  const parsed = z.array(IngredientStorePreferenceSelectSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse ingredient store preferences");

  return parsed.data;
}

/**
 * Get all ingredient store preferences for multiple users (household-level)
 */
export async function listIngredientStorePreferencesForUsers(
  userIds: string[]
): Promise<IngredientStorePreferenceDto[]> {
  if (!userIds.length) return [];

  const rows = await db
    .select()
    .from(ingredientStorePreferences)
    .where(inArray(ingredientStorePreferences.userId, userIds));

  const parsed = z.array(IngredientStorePreferenceSelectSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse ingredient store preferences");

  return parsed.data;
}

export async function upsertIngredientStorePreference(
  userId: string,
  normalizedName: string,
  storeId: string
): Promise<IngredientStorePreferenceDto> {
  const input = { userId, normalizedName, storeId };
  const parsed = IngredientStorePreferenceInsertSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid IngredientStorePreferenceInsertDto");

  const [row] = await db
    .insert(ingredientStorePreferences)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: [ingredientStorePreferences.userId, ingredientStorePreferences.normalizedName],
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
  normalizedName: string
): Promise<void> {
  await db
    .delete(ingredientStorePreferences)
    .where(
      and(
        eq(ingredientStorePreferences.userId, userId),
        eq(ingredientStorePreferences.normalizedName, normalizedName)
      )
    );
}

/**
 * Normalize an ingredient name for store preference matching
 */
export function normalizeIngredientName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
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
 * Find the best matching store preference using fuzzy matching across household.
 *
 * Priority order:
 * 1. Current user exact match
 * 2. Other household member exact match
 * 3. Current user fuzzy match (best score)
 * 4. Other household member fuzzy match (best score)
 *
 * @param currentUserId - The ID of the user making the request
 * @param userIds - All household member IDs (including current user)
 * @param searchName - The ingredient name to search for (will be normalized)
 * @returns The best matching preference or null if no match above threshold
 */
export async function findBestIngredientStorePreference(
  currentUserId: string,
  userIds: string[],
  searchName: string
): Promise<FuzzyPreferenceMatch | null> {
  if (!userIds.length || !searchName.trim()) return null;

  const normalizedSearch = normalizeIngredientName(searchName);

  // Get all preferences for household members
  const allPreferences = await listIngredientStorePreferencesForUsers(userIds);

  if (allPreferences.length === 0) return null;

  // Step 1: Check for exact matches first (prioritize current user)
  const currentUserExact = allPreferences.find(
    (p) => p.userId === currentUserId && p.normalizedName === normalizedSearch
  );

  if (currentUserExact) {
    return {
      preference: currentUserExact,
      score: 0,
      isExactMatch: true,
      isCurrentUser: true,
    };
  }

  const otherUserExact = allPreferences.find(
    (p) => p.userId !== currentUserId && p.normalizedName === normalizedSearch
  );

  if (otherUserExact) {
    return {
      preference: otherUserExact,
      score: 0,
      isExactMatch: true,
      isCurrentUser: false,
    };
  }

  // Step 2: No exact match, use fuzzy matching
  const fuse = new Fuse(allPreferences, FUSE_OPTIONS);
  const results = fuse.search(normalizedSearch);

  if (results.length === 0) return null;

  // Separate results by current user vs others
  const currentUserMatches = results.filter((r) => r.item.userId === currentUserId);
  const otherUserMatches = results.filter((r) => r.item.userId !== currentUserId);

  // Prioritize current user's fuzzy match
  if (currentUserMatches.length > 0) {
    const best = currentUserMatches[0];

    if (!best) return null;

    return {
      preference: best.item,
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
      preference: best.item,
      score: best.score ?? 1,
      isExactMatch: false,
      isCurrentUser: false,
    };
  }

  return null;
}
