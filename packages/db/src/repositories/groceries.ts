import { and, asc, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import z from "zod";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import type {
  GroceryDto,
  GroceryInsertDto,
  GroceryUpdateDto,
} from "@norish/shared/contracts/dto/groceries";
import { db, holdLock } from "@norish/db/drizzle";
import { groceries, recipeIngredients, recipes, recurringGroceries } from "@norish/db/schema";
import {
  GroceryInsertBaseSchema,
  GrocerySelectBaseSchema,
  GroceryUpdateBaseSchema,
} from "@norish/shared/contracts/zod";

import type { IngredientRef } from "./ingredient-aliases";

export async function getGroceryById(id: string): Promise<GroceryDto | null> {
  const [row] = await db.select().from(groceries).where(eq(groceries.id, id)).limit(1);

  if (!row) return null;

  const parsed = GrocerySelectBaseSchema.safeParse(row);

  if (!parsed.success) throw new Error("Failed to parse grocery by id");

  return parsed.data;
}

/** The grocery last added under this name, on anyone's list. */
export async function findNewestGroceryNamed(name: string): Promise<GroceryDto | null> {
  const [row] = await db
    .select()
    .from(groceries)
    .where(eq(groceries.name, name))
    .orderBy(desc(groceries.createdAt))
    .limit(1);

  return row ? GrocerySelectBaseSchema.parse(row) : null;
}

export async function getGroceriesByIds(ids: string[]): Promise<GroceryDto[]> {
  if (ids.length === 0) return [];

  const rows = await db.select().from(groceries).where(inArray(groceries.id, ids));

  const parsed = z.array(GrocerySelectBaseSchema).safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse groceries by ids");

  return parsed.data;
}

/**
 * Groceries' (or recurring groceries') texts and the food each names, by id; one naming no
 * food has none (ADR-0037).
 */
export async function findGroceryFoods(
  ids: readonly string[],
  kind: "groceries" | "recurring" = "groceries"
): Promise<Map<string, { name: string | null; food: IngredientRef | null }>> {
  if (ids.length === 0) return new Map();
  const table = kind === "groceries" ? groceries : recurringGroceries;

  const rows = await db
    .select({
      id: table.id,
      name: table.name,
      aliasId: table.ingredientAliasId,
      ingredientId: table.ingredientId,
    })
    .from(table)
    .where(inArray(table.id, [...new Set(ids)]));

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

export async function updateGrocery(input: GroceryUpdateDto): Promise<GroceryDto | null> {
  const parsed = GroceryUpdateBaseSchema.safeParse(input);

  if (!parsed.success) throw new Error("Invalid GroceryUpdateDto");

  const whereConditions = [eq(groceries.id, input.id)];

  if (parsed.data.version) {
    whereConditions.push(eq(groceries.version, parsed.data.version));
  }

  const [row] = await db
    .update(groceries)
    .set({ ...(parsed.data as any), version: sql`${groceries.version} + 1` })
    .where(and(...whereConditions))
    .returning();

  if (!row) return null;
  const validated = GrocerySelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse updated grocery");

  return validated.data;
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

    const updatedGroceries: GroceryDto[] = [];

    for (const g of parsed.data) {
      const whereConditions = [eq(groceries.id, g.id)];

      if (g.version) {
        whereConditions.push(eq(groceries.version, g.version));
      }

      const [row] = await trx
        .update(groceries)
        .set({ ...(g as any), version: sql`${groceries.version} + 1` })
        .where(and(...whereConditions))
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

export async function toggleGrocery(id: string, isDone?: boolean): Promise<GroceryDto | null> {
  const current = await db
    .select({ id: groceries.id, isDone: groceries.isDone })
    .from(groceries)
    .where(eq(groceries.id, id))
    .limit(1);

  if (!current[0]) return null;

  const next = typeof isDone === "boolean" ? isDone : !current[0].isDone;

  const [row] = await db
    .update(groceries)
    .set({ isDone: next, version: sql`${groceries.version} + 1` })
    .where(eq(groceries.id, id))
    .returning();

  if (!row) return null;
  const validated = GrocerySelectBaseSchema.safeParse(row);

  if (!validated.success) throw new Error("Failed to parse toggled grocery");

  return validated.data;
}

export async function deleteGroceryById(id: string): Promise<void> {
  await db.delete(groceries).where(eq(groceries.id, id));
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
        .where(and(eq(groceries.id, item.id), eq(groceries.version, item.version)))
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
        .where(and(eq(groceries.id, id), eq(groceries.version, version)))
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

/**
 * Assign a grocery to a store within a transaction
 */
export async function assignGroceryToStore(
  groceryId: string,
  newStoreId: string | null,
  _householdId: string,
  version?: number
): Promise<GroceryDto | null> {
  const whereConditions = [eq(groceries.id, groceryId)];

  if (version) {
    whereConditions.push(eq(groceries.version, version));
  }

  const [updated] = await db
    .update(groceries)
    .set({ storeId: newStoreId, updatedAt: new Date(), version: sql`${groceries.version} + 1` })
    .where(and(...whereConditions))
    .returning();

  if (!updated) return null;

  const validatedUpdate = GrocerySelectBaseSchema.safeParse(updated);

  if (!validatedUpdate.success) {
    throw new Error("Failed to parse updated grocery");
  }

  return validatedUpdate.data;
}

/**
 * Get recipe info for groceries that have a recipeIngredientId.
 * Returns a Map of recipeIngredientId -> { recipeId, recipeName }
 */
export async function getRecipeInfoForGroceries(
  recipeIngredientIds: string[]
): Promise<Map<string, { recipeId: string; recipeName: string }>> {
  if (recipeIngredientIds.length === 0) return new Map();

  const rows = await db
    .select({
      recipeIngredientId: recipeIngredients.id,
      recipeId: recipes.id,
      recipeName: recipes.name,
    })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
    .where(inArray(recipeIngredients.id, recipeIngredientIds));

  return new Map(
    rows.map((r) => [r.recipeIngredientId, { recipeId: r.recipeId, recipeName: r.recipeName }])
  );
}
