import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import z from "zod";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import type {
  GroceryDto,
  GroceryInsertDto,
  GroceryUpdateDto,
} from "@norish/shared/contracts/dto/groceries";
import { db, holdLock } from "@norish/db/drizzle";
import { groceries, recipeIngredients, recipes } from "@norish/db/schema";
import {
  GroceryInsertBaseSchema,
  GrocerySelectBaseSchema,
  GroceryUpdateBaseSchema,
} from "@norish/shared/contracts/zod";

import type { IngredientRef } from "./ingredient-aliases";
import { assertOwnReferences, householdRow, householdRows } from "./household-rows";
import { buildPolicyCondition } from "./recipes";

/** The grocery last added under this name on the household's list. */
export async function findNewestGroceryNamed(
  householdId: string,
  name: string
): Promise<GroceryDto | null> {
  const [row] = await db
    .select()
    .from(groceries)
    .where(and(eq(groceries.householdId, householdId), eq(groceries.name, name)))
    .orderBy(desc(groceries.createdAt))
    .limit(1);

  return row ? GrocerySelectBaseSchema.parse(row) : null;
}

export async function getGroceriesByIds(ids: string[], householdId: string): Promise<GroceryDto[]> {
  if (ids.length === 0) return [];

  const rows = await db
    .select()
    .from(groceries)
    .where(householdRows(groceries, householdId, ids));

  const parsed = z.array(GrocerySelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse groceries by ids");

  return parsed.data;
}

/** The household's groceries' texts and the food each names, by id; one naming no food has none (ADR-0037). */
export async function findGroceryFoods(
  ids: readonly string[],
  householdId: string
): Promise<Map<string, { name: string | null; food: IngredientRef | null }>> {
  if (ids.length === 0) return new Map();

  const rows = await db
    .select({
      id: groceries.id,
      name: groceries.name,
      aliasId: groceries.ingredientAliasId,
      ingredientId: groceries.ingredientId,
    })
    .from(groceries)
    .where(householdRows(groceries, householdId, [...new Set(ids)]));

  return new Map(
    rows.map(({ id, name, aliasId, ingredientId }) => [
      id,
      { name, food: aliasId && ingredientId ? { aliasId, ingredientId } : null },
    ])
  );
}

// Each Store numbers its groceries from 0, so a tie goes to no Store first, as the page shows
// them, then to the Store and the id.
const LIST_ORDER = [
  asc(groceries.sortOrder),
  sql`${groceries.storeId} asc nulls first`,
  asc(groceries.id),
];

export async function listGroceriesByHousehold(
  householdId: string,
  options?: { includeDone?: boolean }
): Promise<GroceryDto[]> {
  const includeDone = options?.includeDone ?? true;
  const household = eq(groceries.householdId, householdId);

  const rows = await db
    .select()
    .from(groceries)
    .where(includeDone ? household : and(household, eq(groceries.isDone, false)))
    .orderBy(...LIST_ORDER);

  return parseRows(rows, "groceries");
}

/**
 * What a create leaves behind: the rows made, and every active sibling in the
 * same Store shifted down to make room at the top. Making room is not an edit
 * of the rows that move, so their versions stay and a write queued on them
 * still lands (ADR-0004). The shifted rows are handed back so the answer and
 * the household's `updated` event carry their new sort order.
 */
export interface CreatedGroceries {
  created: GroceryDto[];
  shifted: GroceryDto[];
}

function parseRows(rows: unknown[], what: string): GroceryDto[] {
  const parsed = z.array(GrocerySelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error(`Failed to parse ${what}`);

  return parsed.data;
}

/**
 * Hold the household's list until the transaction ends. Every write of several of its rows takes
 * this before its first, so two such writes wait for each other rather than deadlock.
 */
export async function lockGroceryList(tx: DbTransaction, householdId: string) {
  await holdLock(tx, `groceries:${householdId}`);
}

export async function createGroceries(
  items: { id: string; groceries: GroceryInsertDto }[],
  householdId: string,
  tx: Db = db
): Promise<CreatedGroceries> {
  if (!items.length) return { created: [], shifted: [] };

  const prepared = items.map(({ id, groceries }) => {
    const parsed = GroceryInsertBaseSchema.safeParse(groceries);

    if (!parsed.success) {
      throw new Error("Invalid GroceryInsertDto in batch");
    }

    return { ...parsed.data, id };
  });

  return await tx.transaction(async (trx) => {
    await lockGroceryList(trx, householdId);
    if (prepared.some((item) => item.householdId !== householdId)) {
      throw new Error("Groceries are created in the household whose list is locked");
    }
    await assertOwnReferences(
      householdId,
      {
        storeIds: prepared.map((item) => item.storeId),
        recurringGroceryIds: prepared.map((item) => item.recurringGroceryId),
      },
      trx
    );

    // Group items by storeId for efficient updates
    const storeGroups = new Map<string | null, typeof prepared>();

    for (const item of prepared) {
      const storeKey = item.storeId ?? null;
      const group = storeGroups.get(storeKey) ?? [];

      group.push(item);
      storeGroups.set(storeKey, group);
    }

    // Shift each Store's open lines down; their versions stay, as a planned item's slot-mates do.
    const shifted: GroceryDto[] = [];

    for (const [storeId, storeItems] of storeGroups) {
      const rows = await trx
        .update(groceries)
        .set({
          sortOrder: sql`${groceries.sortOrder} + ${storeItems.length}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(groceries.householdId, householdId),
            eq(groceries.isDone, false),
            storeId ? eq(groceries.storeId, storeId) : isNull(groceries.storeId)
          )
        )
        .returning();

      shifted.push(...parseRows(rows, "shifted groceries"));
    }

    const nextSortOrderByStore = new Map<string | null, number>();

    // Insert new groceries with sortOrder: 0, 1, 2... inside each store group.
    const valuesToInsert = prepared.map((p) => {
      const storeKey = p.storeId ?? null;
      const sortOrder = nextSortOrderByStore.get(storeKey) ?? 0;

      nextSortOrderByStore.set(storeKey, sortOrder + 1);

      return {
        ...(p as any),
        sortOrder,
      };
    });

    const inserted = await trx.insert(groceries).values(valuesToInsert).returning();

    return { created: parseRows(inserted, "created groceries"), shifted };
  });
}

export async function updateGroceries(
  input: GroceryUpdateDto[],
  householdId: string,
  tx: Db = db
): Promise<GroceryDto[]> {
  const parsed = z.array(GroceryUpdateBaseSchema).safeParse(input);

  if (!parsed.success) throw new Error("Invalid GroceryUpdateDto array");

  return await tx.transaction(async (trx) => {
    await lockGroceryList(trx, householdId);
    await assertOwnReferences(
      householdId,
      {
        storeIds: parsed.data.map((g) => g.storeId),
        recurringGroceryIds: parsed.data.map((g) => g.recurringGroceryId),
      },
      trx
    );

    const updatedGroceries: GroceryDto[] = [];

    for (const g of parsed.data) {
      const [row] = await trx
        .update(groceries)
        .set({ ...(g as any), version: sql`${groceries.version} + 1` })
        .where(householdRow(groceries, householdId, g.id, g.version))
        .returning();

      if (row) {
        const validated = GrocerySelectBaseSchema.safeParse(row);

        if (!validated.success) {
          throw new Error(`Failed to parse updated grocery (id=${g.id})`);
        }
        updatedGroceries.push(validated.data);
      }
    }

    return updatedGroceries;
  });
}

export async function deleteGroceryByIds(
  items: Array<{ id: string; version: number }>,
  householdId: string
): Promise<{ deletedIds: string[]; staleIds: string[] }> {
  if (items.length === 0) {
    return { deletedIds: [], staleIds: [] };
  }

  return await db.transaction(async (trx) => {
    await lockGroceryList(trx, householdId);

    const deletedIds: string[] = [];
    const staleIds: string[] = [];

    for (const item of items) {
      const deleted = await trx
        .delete(groceries)
        .where(householdRow(groceries, householdId, item.id, item.version))
        .returning({ id: groceries.id });

      if (deleted.length > 0) {
        deletedIds.push(item.id);
      } else {
        staleIds.push(item.id);
      }
    }

    return { deletedIds, staleIds };
  });
}

export async function deleteDoneGroceriesBefore(beforeDate: string): Promise<number> {
  const beforeDateObj = new Date(beforeDate);
  const result = await db
    .delete(groceries)
    .where(
      and(
        eq(groceries.isDone, true),
        lte(groceries.updatedAt, beforeDateObj),
        isNull(groceries.recurringGroceryId)
      )
    );

  return result.rowCount ?? 0;
}

/** The household each grocery belongs to, by id, for the household guard. */
export async function getGroceryHouseholdIds(groceryIds: string[]): Promise<Map<string, string>> {
  if (groceryIds.length === 0) return new Map();

  const rows = await db
    .select({ id: groceries.id, householdId: groceries.householdId })
    .from(groceries)
    .where(inArray(groceries.id, groceryIds));

  return new Map(rows.map((r) => [r.id, r.householdId]));
}

/**
 * Reorder groceries within a store
 * Updates sortOrder for multiple groceries in a single transaction
 * Optionally updates storeId for items that moved between stores
 */
export async function reorderGroceriesInStore(
  updates: { id: string; version: number; sortOrder: number; storeId?: string | null }[],
  householdId: string
): Promise<GroceryDto[]> {
  if (updates.length === 0) return [];

  return await db.transaction(async (trx) => {
    await lockGroceryList(trx, householdId);
    await assertOwnReferences(householdId, { storeIds: updates.map((u) => u.storeId) }, trx);

    const updatedGroceries: GroceryDto[] = [];

    for (const { id, version, sortOrder, storeId } of updates) {
      // Build update object - always update sortOrder, optionally update storeId
      const updateData: { sortOrder: number; updatedAt: Date; storeId?: string | null } = {
        sortOrder,
        updatedAt: new Date(),
      };

      // Only include storeId if explicitly provided (even if null for "unsorted")
      if (storeId !== undefined) {
        updateData.storeId = storeId;
      }

      const [row] = await trx
        .update(groceries)
        .set({ ...updateData, version: sql`${groceries.version} + 1` })
        .where(householdRow(groceries, householdId, id, version))
        .returning();

      if (row) {
        const validated = GrocerySelectBaseSchema.safeParse(row);

        if (!validated.success) {
          throw new Error(`Failed to parse reordered grocery (id=${id})`);
        }
        updatedGroceries.push(validated.data);
      }
    }

    return updatedGroceries;
  });
}

/**
 * Mark all active (not done) groceries in a store as done
 * Returns the updated groceries
 */
export async function markAllDoneInStore(
  householdId: string,
  storeId: string | null,
  groceriesToMark?: Array<{ id: string; version: number }>
): Promise<GroceryDto[]> {
  if (groceriesToMark && groceriesToMark.length === 0) return [];

  return await db.transaction(async (trx) => {
    await lockGroceryList(trx, householdId);

    if (!groceriesToMark) {
      const whereConditions = [
        eq(groceries.householdId, householdId),
        eq(groceries.isDone, false),
        storeId ? eq(groceries.storeId, storeId) : isNull(groceries.storeId),
      ];

      const rows = await trx
        .update(groceries)
        .set({ isDone: true, updatedAt: new Date(), version: sql`${groceries.version} + 1` })
        .where(and(...whereConditions))
        .returning();

      return parseRows(rows, "marked groceries");
    }

    const updatedRows: (typeof groceries.$inferSelect)[] = [];

    for (const grocery of groceriesToMark) {
      const whereConditions = [
        eq(groceries.householdId, householdId),
        eq(groceries.id, grocery.id),
        eq(groceries.version, grocery.version),
        eq(groceries.isDone, false),
        storeId ? eq(groceries.storeId, storeId) : isNull(groceries.storeId),
      ];

      const [row] = await trx
        .update(groceries)
        .set({ isDone: true, updatedAt: new Date(), version: sql`${groceries.version} + 1` })
        .where(and(...whereConditions))
        .returning();

      if (row) {
        updatedRows.push(row);
      }
    }

    return parseRows(updatedRows, "marked groceries");
  });
}

/**
 * Delete all done groceries in a store
 * Returns the deleted grocery IDs
 */
export async function deleteDoneInStore(
  householdId: string,
  storeId: string | null,
  groceriesToDelete?: Array<{ id: string; version: number }>
): Promise<string[]> {
  if (groceriesToDelete && groceriesToDelete.length === 0) return [];

  return await db.transaction(async (trx) => {
    await lockGroceryList(trx, householdId);

    if (!groceriesToDelete) {
      const whereConditions = [
        eq(groceries.householdId, householdId),
        eq(groceries.isDone, true),
        storeId ? eq(groceries.storeId, storeId) : isNull(groceries.storeId),
      ];

      const rows = await trx
        .delete(groceries)
        .where(and(...whereConditions))
        .returning({ id: groceries.id });

      return rows.map((r) => r.id);
    }

    const deletedIds: string[] = [];

    for (const grocery of groceriesToDelete) {
      const whereConditions = [
        eq(groceries.householdId, householdId),
        eq(groceries.id, grocery.id),
        eq(groceries.version, grocery.version),
        eq(groceries.isDone, true),
        storeId ? eq(groceries.storeId, storeId) : isNull(groceries.storeId),
      ];

      const deleted = await trx
        .delete(groceries)
        .where(and(...whereConditions))
        .returning({ id: groceries.id });

      if (deleted.length > 0) {
        deletedIds.push(grocery.id);
      }
    }

    return deletedIds;
  });
}

/** File the household's grocery under one of its Stores, or none. */
export async function assignGroceryToStore(
  groceryId: string,
  newStoreId: string | null,
  householdId: string,
  version?: number
): Promise<GroceryDto | null> {
  await assertOwnReferences(householdId, { storeIds: [newStoreId] });

  const [updated] = await db
    .update(groceries)
    .set({ storeId: newStoreId, updatedAt: new Date(), version: sql`${groceries.version} + 1` })
    .where(householdRow(groceries, householdId, groceryId, version))
    .returning();

  if (!updated) return null;

  const validatedUpdate = GrocerySelectBaseSchema.safeParse(updated);

  if (!validatedUpdate.success) {
    throw new Error("Failed to parse updated grocery");
  }

  return validatedUpdate.data;
}

/**
 * The recipe of each grocery line a recipe added, by recipe line id, for the recipes the
 * household may view now. A line of one out of view is left out: it lists with the hand-added.
 */
export async function getRecipeInfoForGroceries(
  recipeIngredientIds: string[],
  householdId: string
): Promise<Map<string, { recipeId: string; recipeName: string }>> {
  if (recipeIngredientIds.length === 0) return new Map();

  const viewable = await buildPolicyCondition({ householdId }, recipes.householdId, "view");

  const rows = await db
    .select({
      recipeIngredientId: recipeIngredients.id,
      recipeId: recipes.id,
      recipeName: recipes.name,
    })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
    .where(and(inArray(recipeIngredients.id, recipeIngredientIds), viewable));

  return new Map(
    rows.map((r) => [r.recipeIngredientId, { recipeId: r.recipeId, recipeName: r.recipeName }])
  );
}
