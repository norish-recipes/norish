import type { StoreDto, StoreInsertDto, StoreUpdateDto, IngredientStorePreferenceDto } from "@/types";

import { and, eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import { db } from "@/server/db/drizzle";
import { stores, ingredientStorePreferences, groceries } from "@/server/db/schema";
import {
  StoreSelectBaseSchema,
  StoreInsertBaseSchema,
  StoreUpdateBaseSchema,
  IngredientStorePreferenceSelectSchema,
  IngredientStorePreferenceInsertSchema,
} from "@/server/db/zodSchemas";

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

  const [row] = await db
    .update(stores)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(stores.id, input.id))
    .returning();

  if (!row) return null;

  const validated = StoreSelectBaseSchema.safeParse(row);
  if (!validated.success) throw new Error("Failed to parse updated store");

  return validated.data;
}

export async function reorderStores(storeIds: string[]): Promise<StoreDto[]> {
  return await db.transaction(async (trx) => {
    const updatedStores: StoreDto[] = [];

    for (let i = 0; i < storeIds.length; i++) {
      const [row] = await trx
        .update(stores)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(stores.id, storeIds[i]))
        .returning();

      if (row) {
        const validated = StoreSelectBaseSchema.safeParse(row);
        if (!validated.success) throw new Error(`Failed to parse reordered store (id=${storeIds[i]})`);
        updatedStores.push(validated.data);
      }
    }

    return updatedStores;
  });
}

export async function deleteStore(
  storeId: string,
  deleteGroceries: boolean
): Promise<{ deletedGroceryIds: string[] }> {
  return await db.transaction(async (trx) => {
    let deletedGroceryIds: string[] = [];

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
        .set({ storeId: null, updatedAt: new Date() })
        .where(eq(groceries.storeId, storeId));
    }

    // Delete ingredient preferences for this store
    await trx.delete(ingredientStorePreferences).where(eq(ingredientStorePreferences.storeId, storeId));

    // Delete the store
    await trx.delete(stores).where(eq(stores.id, storeId));

    return { deletedGroceryIds };
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

export async function listIngredientStorePreferences(userId: string): Promise<IngredientStorePreferenceDto[]> {
  const rows = await db
    .select()
    .from(ingredientStorePreferences)
    .where(eq(ingredientStorePreferences.userId, userId));

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
      set: { storeId, updatedAt: new Date() },
    })
    .returning();

  const validated = IngredientStorePreferenceSelectSchema.safeParse(row);
  if (!validated.success) throw new Error("Failed to parse upserted ingredient store preference");

  return validated.data;
}

export async function deleteIngredientStorePreference(userId: string, normalizedName: string): Promise<void> {
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
