import type { IFuseOptions } from "fuse.js";
import { and, eq, sql } from "drizzle-orm";
import Fuse from "fuse.js";
import z from "zod";

import type { Db } from "@norish/db/drizzle";
import type { GroceryDto } from "@norish/shared/contracts/dto/groceries";
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
  GrocerySelectBaseSchema,
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
async function withAisles(rows: (typeof stores.$inferSelect)[], tx: Db = db): Promise<StoreDto[]> {
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

export async function listStoresByHousehold(householdId: string): Promise<StoreDto[]> {
  const rows = await db
    .select()
    .from(stores)
    .where(eq(stores.householdId, householdId))
    // Stores made before ordering existed share a position; keep them in a fixed order.
    .orderBy(stores.sortOrder, stores.createdAt, stores.id);

  return withAisles(rows);
}

export async function checkStoreNameExistsInHousehold(
  name: string,
  householdId: string,
  excludeStoreId?: string
): Promise<boolean> {
  const normalizedName = name.toLowerCase().trim();

  const conditions = [
    eq(stores.householdId, householdId),
    sql`LOWER(TRIM(${stores.name})) = ${normalizedName}`,
  ];

  if (excludeStoreId) {
    conditions.push(sql`${stores.id} != ${excludeStoreId}`);
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(stores)
    .where(and(...conditions));

  return (row?.count ?? 0) > 0;
}

export async function createStore(id: string, input: StoreInsertDto): Promise<StoreDto> {
  const parsed = StoreInsertBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid StoreInsertDto");
  const { aisles, ...columns } = parsed.data;

  return await db.transaction(async (trx) => {
    const [maxOrder] = await trx
      .select({ max: sql<number>`COALESCE(MAX(${stores.sortOrder}), -1)` })
      .from(stores)
      .where(eq(stores.householdId, input.householdId));

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
  storeUpdates: { id: string; version: number }[],
  householdId: string
): Promise<StoreDto[]> {
  return await db.transaction(async (trx) => {
    const updatedRows: (typeof stores.$inferSelect)[] = [];

    for (let i = 0; i < storeUpdates.length; i++) {
      const storeUpdate = storeUpdates[i];

      if (!storeUpdate) continue;

      const [row] = await trx
        .update(stores)
        // Renumbering is not an edit: the version stays, so a write queued on it still lands.
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(
          and(
            eq(stores.id, storeUpdate.id),
            eq(stores.version, storeUpdate.version),
            eq(stores.householdId, householdId)
          )
        )
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
): Promise<{
  deletedGroceryIds: string[];
  movedGroceries: GroceryDto[];
  storeDeleted: boolean;
  stale: boolean;
}> {
  return await db.transaction(async (trx) => {
    let deletedGroceryIds: string[] = [];
    const movedGroceries: GroceryDto[] = [];
    const keepMoved = (rows: unknown[]) => {
      for (const row of rows) movedGroceries.push(GrocerySelectBaseSchema.parse(row));
    };

    const [storeRow] = await trx
      .select({ id: stores.id })
      .from(stores)
      .where(and(eq(stores.id, storeId), eq(stores.version, version)))
      .limit(1);

    if (!storeRow) {
      return { deletedGroceryIds, movedGroceries, storeDeleted: false, stale: true };
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
          const moved = await trx
            .update(groceries)
            .set({ storeId: null, updatedAt: new Date(), version: sql`${groceries.version} + 1` })
            .where(
              and(
                eq(groceries.id, grocery.id),
                eq(groceries.version, grocery.version),
                eq(groceries.storeId, storeId)
              )
            )
            .returning();

          keepMoved(moved);
        }
      }

      // Only delete store if it is empty after processing the snapshot
      const [remainingCount] = await trx
        .select({ count: sql<number>`count(*)::int` })
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
          return { deletedGroceryIds, movedGroceries, storeDeleted: false, stale: true };
        }
      }

      return { deletedGroceryIds, movedGroceries, storeDeleted: isEmpty, stale: false };
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
      keepMoved(
        await trx
          .update(groceries)
          .set({ storeId: null, updatedAt: new Date(), version: sql`${groceries.version} + 1` })
          .where(eq(groceries.storeId, storeId))
          .returning()
      );
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
      return { deletedGroceryIds, movedGroceries, storeDeleted: false, stale: true };
    }

    return { deletedGroceryIds, movedGroceries, storeDeleted: true, stale: false };
  });
}

/** The household a Store belongs to, for the household guard. */
export async function getStoreHouseholdId(storeId: string): Promise<string | null> {
  const [row] = await db
    .select({ householdId: stores.householdId })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  return row?.householdId ?? null;
}

export async function countGroceriesInStore(storeId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(groceries)
    .where(eq(groceries.storeId, storeId));

  return row?.count ?? 0;
}

export async function getIngredientStorePreference(
  householdId: string,
  ingredientId: string
): Promise<IngredientStorePreferenceDto | null> {
  const [row] = await db
    .select()
    .from(ingredientStorePreferences)
    .where(
      and(
        eq(ingredientStorePreferences.householdId, householdId),
        eq(ingredientStorePreferences.ingredientId, ingredientId)
      )
    )
    .limit(1);

  if (!row) return null;

  const parsed = IngredientStorePreferenceSelectSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse ingredient store preference");

  return parsed.data;
}

/** A store preference with the name of the Ingredient it is for. */
type NamedPreference = IngredientStorePreferenceDto & { ingredientName: string };

/** The household's store preferences, each with its Ingredient's name. */
async function listNamedPreferences(householdId: string): Promise<NamedPreference[]> {
  const rows = await db
    .select({ preference: ingredientStorePreferences, ingredientName: ingredients.name })
    .from(ingredientStorePreferences)
    .innerJoin(ingredients, eq(ingredients.id, ingredientStorePreferences.ingredientId))
    .where(eq(ingredientStorePreferences.householdId, householdId));

  const parsed = z
    .array(IngredientStorePreferenceSelectSchema)
    .safeParse(rows.map((row) => row.preference));

  if (!parsed.success) throw new Error("Failed to parse ingredient store preferences");

  return parsed.data.map((preference, index) => ({
    ...preference,
    ingredientName: rows[index]!.ingredientName,
  }));
}

/**
 * Remember the Store a household sends an Ingredient to, one per household and
 * Ingredient, so a preference for "milk" holds for "melk" (ADR-0037).
 */
export async function upsertIngredientStorePreference(
  householdId: string,
  userId: string,
  ingredientId: string,
  storeId: string
): Promise<IngredientStorePreferenceDto> {
  const input = { householdId, userId, ingredientId, storeId };
  const parsed = IngredientStorePreferenceInsertSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid IngredientStorePreferenceInsertDto");

  const [row] = await db
    .insert(ingredientStorePreferences)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: [ingredientStorePreferences.householdId, ingredientStorePreferences.ingredientId],
      set: {
        storeId,
        userId,
        updatedAt: new Date(),
        version: sql`${ingredientStorePreferences.version} + 1`,
      },
    })
    .returning();

  const validated = IngredientStorePreferenceSelectSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse upserted ingredient store preference");

  return validated.data;
}

/** Result type for fuzzy preference matching */
export interface FuzzyPreferenceMatch {
  preference: IngredientStorePreferenceDto;
  score: number; // 0 = perfect match, higher = worse match
  isExactMatch: boolean;
}

/**
 * Find the Store the household sends an Ingredient to: its preference for the
 * Ingredient, else the best fuzzy match on the preferred Ingredients' names.
 */
export async function findBestIngredientStorePreference(
  householdId: string,
  ingredient: { id: string; name: string }
): Promise<FuzzyPreferenceMatch | null> {
  if (!ingredient.name.trim()) return null;

  const allPreferences = await listNamedPreferences(householdId);

  if (allPreferences.length === 0) return null;

  const strip = ({ ingredientName: _name, ...preference }: NamedPreference) => preference;
  const exact = allPreferences.find((p) => p.ingredientId === ingredient.id);

  if (exact) return { preference: strip(exact), score: 0, isExactMatch: true };

  const [best] = new Fuse(allPreferences, FUSE_OPTIONS).search(
    normalizePreferenceSearch(ingredient.name)
  );

  if (!best) return null;

  return { preference: strip(best.item), score: best.score ?? 1, isExactMatch: false };
}

function normalizePreferenceSearch(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}
