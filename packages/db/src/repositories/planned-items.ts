import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { PlannedItemEdit } from "@norish/shared/contracts/zod";
import { db } from "@norish/db/drizzle";
import { plannedItems, recipes, users } from "@norish/db/schema";
import { plannedItemEditTarget } from "@norish/shared/contracts/zod";

import type { MutationOutcome } from "./mutation-outcomes";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { PRIMARY_IMAGE_SQL } from "./recipe-primary-image";

type PlannedItem = typeof plannedItems.$inferSelect;
type PlannedItemInsert = typeof plannedItems.$inferInsert;
type PlannedItemSlot = PlannedItem["slot"];

export type PlannedItemWithRecipe = PlannedItem & {
  recipeName: string | null;
  recipeImage: string | null;
  servings: number | null;
  calories: number | null;
};

export async function listPlannedItemsByUserAndDateRange(
  userIds: string[],
  startDate: string,
  endDate: string
): Promise<PlannedItemWithRecipe[]> {
  if (!userIds.length) return [];

  return await db
    .select({
      id: plannedItems.id,
      userId: plannedItems.userId,
      date: plannedItems.date,
      slot: plannedItems.slot,
      sortOrder: plannedItems.sortOrder,
      itemType: plannedItems.itemType,
      recipeId: plannedItems.recipeId,
      title: plannedItems.title,
      version: plannedItems.version,
      createdAt: plannedItems.createdAt,
      updatedAt: plannedItems.updatedAt,
      recipeName: recipes.name,
      recipeImage: PRIMARY_IMAGE_SQL.as("recipeImage"),
      servings: recipes.servings,
      calories: recipes.calories,
    })
    .from(plannedItems)
    .leftJoin(recipes, eq(plannedItems.recipeId, recipes.id))
    .where(
      and(
        inArray(plannedItems.userId, userIds),
        gte(plannedItems.date, startDate),
        lte(plannedItems.date, endDate)
      )
    )
    .orderBy(asc(plannedItems.date), asc(plannedItems.slot), asc(plannedItems.sortOrder));
}

export async function listPlannedItemsWithRecipeBySlot(
  userIds: string[],
  date: string,
  slot: PlannedItemSlot
): Promise<PlannedItemWithRecipe[]> {
  if (!userIds.length) return [];

  return await db
    .select({
      id: plannedItems.id,
      userId: plannedItems.userId,
      date: plannedItems.date,
      slot: plannedItems.slot,
      sortOrder: plannedItems.sortOrder,
      itemType: plannedItems.itemType,
      recipeId: plannedItems.recipeId,
      title: plannedItems.title,
      version: plannedItems.version,
      createdAt: plannedItems.createdAt,
      updatedAt: plannedItems.updatedAt,
      recipeName: recipes.name,
      recipeImage: PRIMARY_IMAGE_SQL.as("recipeImage"),
      servings: recipes.servings,
      calories: recipes.calories,
    })
    .from(plannedItems)
    .leftJoin(recipes, eq(plannedItems.recipeId, recipes.id))
    .where(
      and(
        inArray(plannedItems.userId, userIds),
        eq(plannedItems.date, date),
        eq(plannedItems.slot, slot)
      )
    )
    .orderBy(asc(plannedItems.sortOrder));
}

export async function getPlannedItemWithRecipeById(
  id: string
): Promise<PlannedItemWithRecipe | null> {
  const [row] = await db
    .select({
      id: plannedItems.id,
      userId: plannedItems.userId,
      date: plannedItems.date,
      slot: plannedItems.slot,
      sortOrder: plannedItems.sortOrder,
      itemType: plannedItems.itemType,
      recipeId: plannedItems.recipeId,
      title: plannedItems.title,
      version: plannedItems.version,
      createdAt: plannedItems.createdAt,
      updatedAt: plannedItems.updatedAt,
      recipeName: recipes.name,
      recipeImage: PRIMARY_IMAGE_SQL.as("recipeImage"),
      servings: recipes.servings,
      calories: recipes.calories,
    })
    .from(plannedItems)
    .leftJoin(recipes, eq(plannedItems.recipeId, recipes.id))
    .where(eq(plannedItems.id, id))
    .limit(1);

  return row ?? null;
}

export async function listPlannedItemsBySlot(
  userIds: string[],
  date: string,
  slot: PlannedItemSlot
): Promise<PlannedItem[]> {
  if (!userIds.length) return [];

  return await db
    .select()
    .from(plannedItems)
    .where(
      and(
        inArray(plannedItems.userId, userIds),
        eq(plannedItems.date, date),
        eq(plannedItems.slot, slot)
      )
    )
    .orderBy(asc(plannedItems.sortOrder));
}

export async function getPlannedItemById(id: string): Promise<PlannedItem | null> {
  const [row] = await db.select().from(plannedItems).where(eq(plannedItems.id, id)).limit(1);

  return row ?? null;
}

export async function createPlannedItem(input: PlannedItemInsert): Promise<PlannedItem> {
  return await db.transaction(async (trx) => {
    await lockPlanner(trx, input.userId);
    const [last] = await trx
      .select({ sortOrder: plannedItems.sortOrder })
      .from(plannedItems)
      .where(
        and(
          eq(plannedItems.userId, input.userId),
          eq(plannedItems.date, input.date),
          eq(plannedItems.slot, input.slot)
        )
      )
      .orderBy(desc(plannedItems.sortOrder))
      .limit(1);

    const [row] = await trx
      .insert(plannedItems)
      .values({ ...input, sortOrder: (last?.sortOrder ?? -1) + 1 })
      .returning();

    if (!row) {
      throw new Error("Failed to create planned item");
    }

    return row;
  });
}

export async function deletePlannedItem(
  id: string,
  version?: number
): Promise<MutationOutcome<{ deletedItem: PlannedItem; reindexedItems: PlannedItem[] }>> {
  return await db.transaction(async (trx) => {
    if (!(await lockPlannerOf(trx, id))) return staleOutcome();

    const deleteWhereConditions = [eq(plannedItems.id, id)];

    if (version) {
      deleteWhereConditions.push(eq(plannedItems.version, version));
    }

    const [deletedItem] = await trx
      .delete(plannedItems)
      .where(and(...deleteWhereConditions))
      .returning();

    if (!deletedItem) {
      return staleOutcome();
    }

    const remaining = await trx
      .select()
      .from(plannedItems)
      .where(
        and(
          eq(plannedItems.userId, deletedItem.userId),
          eq(plannedItems.date, deletedItem.date),
          eq(plannedItems.slot, deletedItem.slot)
        )
      )
      .orderBy(asc(plannedItems.sortOrder));

    const updated: PlannedItem[] = [];

    for (let i = 0; i < remaining.length; i += 1) {
      const item = remaining[i];

      if (!item) continue;
      const [row] = await trx
        .update(plannedItems)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(plannedItems.id, item.id))
        .returning();

      if (row) updated.push(row);
    }

    return appliedOutcome({ deletedItem, reindexedItems: updated });
  });
}

export async function deletePlannedItemsBefore(beforeDate: string): Promise<number> {
  const result = await db.delete(plannedItems).where(lte(plannedItems.date, beforeDate));

  return result.rowCount ?? 0;
}

/** Where a move puts the item; no index: last in the slot. */
type PlannedItemMove = { date: string; slot: PlannedItemSlot; index?: number };

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Every write that renumbers a planner's slots takes this lock first, so two never wait on each other.
async function lockPlanner(trx: Transaction, userId: string) {
  await trx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("no key update");
}

/** Locks the planner of a plan; false when the plan is gone. */
async function lockPlannerOf(trx: Transaction, itemId: string): Promise<boolean> {
  const [owner] = await trx
    .select({ userId: plannedItems.userId })
    .from(plannedItems)
    .where(eq(plannedItems.id, itemId))
    .limit(1);

  if (!owner) return false;
  await lockPlanner(trx, owner.userId);

  return true;
}

// Under the planner's lock: a second write at the same version waits, then finds no row at that version.
async function selectCurrent(trx: Transaction, itemId: string, version?: number) {
  if (!(await lockPlannerOf(trx, itemId))) return null;

  const conditions = [eq(plannedItems.id, itemId)];

  if (version) conditions.push(eq(plannedItems.version, version));

  const [current] = await trx
    .select()
    .from(plannedItems)
    .where(and(...conditions))
    .limit(1);

  return current ?? null;
}

/**
 * Writes the locked item's new title and place in one update with one bump; a move renumbers both
 * slots. The item is always written, so a refused edit never reaches here to leave a renumbering.
 */
async function writeEdit(
  trx: Transaction,
  current: PlannedItem,
  { title, move }: { title?: string; move?: PlannedItemMove }
): Promise<MutationOutcome<PlannedItem>> {
  const itemId = current.id;
  const guard = eq(plannedItems.id, itemId);
  const written = {
    ...(title === undefined ? {} : { title }),
    updatedAt: new Date(),
    version: sql`${plannedItems.version} + 1`,
  };

  if (!move) {
    const [row] = await trx.update(plannedItems).set(written).where(guard).returning();

    return appliedOutcome(writtenRow(row));
  }

  const { date: targetDate, slot: targetSlot, index: targetIndex } = move;
  const sourceItems = await trx
    .select()
    .from(plannedItems)
    .where(
      and(
        eq(plannedItems.userId, current.userId),
        eq(plannedItems.date, current.date),
        eq(plannedItems.slot, current.slot)
      )
    )
    .orderBy(asc(plannedItems.sortOrder));

  const sameSlot = current.date === targetDate && current.slot === targetSlot;
  const targetItems = sameSlot
    ? sourceItems
    : await trx
        .select()
        .from(plannedItems)
        .where(
          and(
            eq(plannedItems.userId, current.userId),
            eq(plannedItems.date, targetDate),
            eq(plannedItems.slot, targetSlot)
          )
        )
        .orderBy(asc(plannedItems.sortOrder));

  const sourceWithout = sourceItems.filter((item) => item.id !== itemId);
  const nextTargetItems = sameSlot ? [...sourceWithout] : [...targetItems];
  const clampedIndex = Math.max(
    0,
    Math.min(targetIndex ?? nextTargetItems.length, nextTargetItems.length)
  );

  nextTargetItems.splice(clampedIndex, 0, { ...current, date: targetDate, slot: targetSlot });

  if (!sameSlot) {
    for (let i = 0; i < sourceWithout.length; i += 1) {
      const item = sourceWithout[i];

      if (!item) continue;

      await trx
        .update(plannedItems)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(plannedItems.id, item.id))
        .returning();
    }
  }

  let moved: PlannedItem | null = null;

  for (let i = 0; i < nextTargetItems.length; i += 1) {
    const item = nextTargetItems[i];

    if (!item) continue;
    const isMoved = item.id === itemId;
    // Only the moved plan's version moves: slot-mates' order changes, they were not written.
    const [row] = await trx
      .update(plannedItems)
      .set(
        isMoved
          ? { ...written, sortOrder: i, date: targetDate, slot: targetSlot }
          : { sortOrder: i, updatedAt: new Date() }
      )
      .where(isMoved ? guard : eq(plannedItems.id, item.id))
      .returning();

    if (row && isMoved) {
      moved = row;
    }
  }

  return appliedOutcome(writtenRow(moved));
}

// The row is locked, so a missing one is a broken invariant: throwing rolls the transaction back.
function writtenRow(row: PlannedItem | null | undefined): PlannedItem {
  if (!row) throw new Error("Locked planned item was not written");

  return row;
}

export async function moveItem(
  itemId: string,
  targetDate: string,
  targetSlot: PlannedItemSlot,
  /** Undefined: last in the target slot. */
  targetIndex: number | undefined,
  version?: number
): Promise<MutationOutcome<PlannedItem>> {
  return await db.transaction(async (trx) => {
    const current = await selectCurrent(trx, itemId, version);

    if (!current) return staleOutcome();

    return writeEdit(trx, current, {
      move: { date: targetDate, slot: targetSlot, index: targetIndex },
    });
  });
}

/** Title, date and slot under one version check; nothing to change writes nothing. */
export async function editPlannedItem(
  itemId: string,
  edit: PlannedItemEdit,
  version: number
): Promise<MutationOutcome<PlannedItem>> {
  return await db.transaction(async (trx) => {
    const current = await selectCurrent(trx, itemId, version);

    if (!current) return staleOutcome();

    const move = plannedItemEditTarget(current, edit);

    if (!move && edit.title === undefined) return appliedOutcome(current);

    return writeEdit(trx, current, { title: edit.title, move });
  });
}

export async function getPlannedItemOwnerId(itemId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: plannedItems.userId })
    .from(plannedItems)
    .where(eq(plannedItems.id, itemId))
    .limit(1);

  return row?.userId ?? null;
}
