import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { PlannedItemEdit } from "@norish/shared/contracts/zod";
import { db } from "@norish/db/drizzle";
import { households, plannedItems, recipes } from "@norish/db/schema";
import { plannedItemEditTarget } from "@norish/shared/contracts/zod";

import type { MutationOutcome } from "./mutation-outcomes";
import { currentHouseholdIdSql } from "./household-members";
import { householdRow } from "./household-rows";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { PRIMARY_IMAGE_SQL } from "./recipe-primary-image";

type PlannedItem = typeof plannedItems.$inferSelect;
type PlannedItemInsert = typeof plannedItems.$inferInsert;
type PlannedItemSlot = PlannedItem["slot"];

/** A plan entry as screens read it; its household is the reader's own. */
export type PlannedItemWithRecipe = Omit<PlannedItem, "householdId"> & {
  recipeName: string | null;
  recipeImage: string | null;
  servings: number | null;
  calories: number | null;
};

/** Every read of plan entries as screens show them: the entry and its recipe's name and picture. */
function selectWithRecipe() {
  return db
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
    .leftJoin(recipes, eq(plannedItems.recipeId, recipes.id));
}

export async function listPlannedItemsByHouseholdAndDateRange(
  householdId: string,
  startDate: string,
  endDate: string
): Promise<PlannedItemWithRecipe[]> {
  return await selectWithRecipe()
    .where(
      and(
        eq(plannedItems.householdId, householdId),
        gte(plannedItems.date, startDate),
        lte(plannedItems.date, endDate)
      )
    )
    .orderBy(asc(plannedItems.date), asc(plannedItems.slot), asc(plannedItems.sortOrder));
}

/** The household's entries a member added, from `fromDate` on: what their calendar carries. */
export async function listPlannedItemsAddedBy(
  householdId: string,
  userId: string,
  fromDate: string
): Promise<PlannedItemWithRecipe[]> {
  return await selectWithRecipe()
    .where(
      and(
        eq(plannedItems.householdId, householdId),
        eq(plannedItems.userId, userId),
        gte(plannedItems.date, fromDate)
      )
    )
    .orderBy(asc(plannedItems.date), asc(plannedItems.slot), asc(plannedItems.sortOrder));
}

export async function listPlannedItemsWithRecipeBySlot(
  householdId: string,
  date: string,
  slot: PlannedItemSlot
): Promise<PlannedItemWithRecipe[]> {
  return await selectWithRecipe()
    .where(
      and(
        eq(plannedItems.householdId, householdId),
        eq(plannedItems.date, date),
        eq(plannedItems.slot, slot)
      )
    )
    .orderBy(asc(plannedItems.sortOrder));
}

export async function getPlannedItemWithRecipeById(
  id: string,
  householdId: string
): Promise<PlannedItemWithRecipe | null> {
  const [row] = await selectWithRecipe()
    .where(householdRow(plannedItems, householdId, id))
    .limit(1);

  return row ?? null;
}

/** Whether the entry is in the household the account is in now, another one, or gone. */
export async function findPlannedItemPlace(
  itemId: string,
  userId: string
): Promise<"current" | "elsewhere" | null> {
  const [row] = await db
    .select({
      current: sql<boolean>`${inArray(plannedItems.householdId, currentHouseholdIdSql(userId))}`,
    })
    .from(plannedItems)
    .where(eq(plannedItems.id, itemId))
    .limit(1);

  if (!row) return null;

  return row.current ? "current" : "elsewhere";
}

export async function listPlannedItemsBySlot(
  householdId: string,
  date: string,
  slot: PlannedItemSlot
): Promise<PlannedItem[]> {
  return await db
    .select()
    .from(plannedItems)
    .where(
      and(
        eq(plannedItems.householdId, householdId),
        eq(plannedItems.date, date),
        eq(plannedItems.slot, slot)
      )
    )
    .orderBy(asc(plannedItems.sortOrder));
}

export async function getPlannedItemById(
  id: string,
  householdId: string
): Promise<PlannedItem | null> {
  const [row] = await db
    .select()
    .from(plannedItems)
    .where(householdRow(plannedItems, householdId, id))
    .limit(1);

  return row ?? null;
}

export async function createPlannedItem(input: PlannedItemInsert): Promise<PlannedItem> {
  return await db.transaction(async (trx) => {
    await lockHousehold(trx, input.householdId);
    const [last] = await trx
      .select({ sortOrder: plannedItems.sortOrder })
      .from(plannedItems)
      .where(
        and(
          eq(plannedItems.householdId, input.householdId),
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
  householdId: string,
  version?: number
): Promise<MutationOutcome<{ deletedItem: PlannedItem; reindexedItems: PlannedItem[] }>> {
  return await db.transaction(async (trx) => {
    await lockHousehold(trx, householdId);

    const [deletedItem] = await trx
      .delete(plannedItems)
      .where(householdRow(plannedItems, householdId, id, version))
      .returning();

    if (!deletedItem) {
      return staleOutcome();
    }

    const remaining = await trx
      .select()
      .from(plannedItems)
      .where(
        and(
          eq(plannedItems.householdId, deletedItem.householdId),
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

// Every write that renumbers a household's slots locks its household row first, so two queue, not deadlock.
async function lockHousehold(trx: Transaction, householdId: string) {
  await trx
    .select({ id: households.id })
    .from(households)
    .where(eq(households.id, householdId))
    .for("no key update");
}

// Under the household lock: a second write at the same version waits, then finds no row at that version.
async function selectCurrent(
  trx: Transaction,
  itemId: string,
  householdId: string,
  version?: number
) {
  await lockHousehold(trx, householdId);

  const [current] = await trx
    .select()
    .from(plannedItems)
    .where(householdRow(plannedItems, householdId, itemId, version))
    .limit(1);

  return current ?? null;
}

/** Writes the item's new title and place in one update with one bump; a move renumbers both slots.
 * The item is always written, so a refused edit never reaches here to leave a renumbering. */
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
        eq(plannedItems.householdId, current.householdId),
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
            eq(plannedItems.householdId, current.householdId),
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
  householdId: string,
  itemId: string,
  targetDate: string,
  targetSlot: PlannedItemSlot,
  /** Undefined: last in the target slot. */
  targetIndex: number | undefined,
  version?: number
): Promise<MutationOutcome<PlannedItem>> {
  return await db.transaction(async (trx) => {
    const current = await selectCurrent(trx, itemId, householdId, version);

    if (!current) return staleOutcome();

    return writeEdit(trx, current, {
      move: { date: targetDate, slot: targetSlot, index: targetIndex },
    });
  });
}

/** Title, date and slot under one version check; nothing to change writes nothing. */
export async function editPlannedItem(
  householdId: string,
  itemId: string,
  edit: PlannedItemEdit,
  version: number
): Promise<MutationOutcome<PlannedItem>> {
  return await db.transaction(async (trx) => {
    const current = await selectCurrent(trx, itemId, householdId, version);

    if (!current) return staleOutcome();

    const move = plannedItemEditTarget(current, edit);

    if (!move && edit.title === undefined) return appliedOutcome(current);

    return writeEdit(trx, current, { title: edit.title, move });
  });
}

/** The household a plan entry belongs to, for the household guard. */
export async function getPlannedItemHouseholdId(itemId: string): Promise<string | null> {
  const [row] = await db
    .select({ householdId: plannedItems.householdId })
    .from(plannedItems)
    .where(eq(plannedItems.id, itemId))
    .limit(1);

  return row?.householdId ?? null;
}
