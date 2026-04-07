import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { plannedItems, recipes } from "@norish/db/schema";

import type { MutationOutcome } from "./mutation-outcomes";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";

type PlannedItem = typeof plannedItems.$inferSelect;
type PlannedItemInsert = typeof plannedItems.$inferInsert;
type PlannedItemUpdate = Partial<PlannedItemInsert>;
type PlannedItemSlot = PlannedItem["slot"];

type PlannedItemWithRecipe = PlannedItem & {
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
      recipeImage: recipes.image,
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
      recipeImage: recipes.image,
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
      recipeImage: recipes.image,
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

export async function getMaxSortOrder(
  userIds: string[],
  date: string,
  slot: PlannedItemSlot
): Promise<number> {
  if (!userIds.length) return -1;

  const [row] = await db
    .select({ max: sql<number>`max(${plannedItems.sortOrder})` })
    .from(plannedItems)
    .where(
      and(
        inArray(plannedItems.userId, userIds),
        eq(plannedItems.date, date),
        eq(plannedItems.slot, slot)
      )
    );

  return typeof row?.max === "number" ? row.max : -1;
}

export async function createPlannedItem(input: PlannedItemInsert): Promise<PlannedItem> {
  const maxSortOrder = await getMaxSortOrder([input.userId], input.date, input.slot);
  const sortOrder = maxSortOrder + 1;

  const [row] = await db
    .insert(plannedItems)
    .values({ ...input, sortOrder })
    .returning();

  if (!row) {
    throw new Error("Failed to create planned item");
  }

  return row;
}

export async function updatePlannedItem(
  id: string,
  updates: PlannedItemUpdate,
  version?: number
): Promise<MutationOutcome<PlannedItem>> {
  const whereConditions = [eq(plannedItems.id, id)];

  if (version) {
    whereConditions.push(eq(plannedItems.version, version));
  }

  const [row] = await db
    .update(plannedItems)
    .set({ ...updates, updatedAt: new Date(), version: sql`${plannedItems.version} + 1` })
    .where(and(...whereConditions))
    .returning();

  if (!row) {
    return staleOutcome();
  }

  return appliedOutcome(row);
}

export async function deletePlannedItem(
  id: string,
  version?: number
): Promise<MutationOutcome<{ deletedItem: PlannedItem; reindexedItems: PlannedItem[] }>> {
  return await db.transaction(async (trx) => {
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
        .set({ sortOrder: i, updatedAt: new Date(), version: sql`${plannedItems.version} + 1` })
        .where(eq(plannedItems.id, item.id))
        .returning();

      if (row) updated.push(row);
    }

    return appliedOutcome({ deletedItem, reindexedItems: updated });
  });
}

export async function moveItem(
  itemId: string,
  targetDate: string,
  targetSlot: PlannedItemSlot,
  targetIndex: number,
  version?: number
): Promise<MutationOutcome<PlannedItem>> {
  return await db.transaction(async (trx) => {
    const currentWhereConditions = [eq(plannedItems.id, itemId)];

    if (version) {
      currentWhereConditions.push(eq(plannedItems.version, version));
    }

    const [current] = await trx
      .select()
      .from(plannedItems)
      .where(and(...currentWhereConditions))
      .limit(1);

    if (!current) return staleOutcome();

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
    const clampedIndex = Math.max(0, Math.min(targetIndex, nextTargetItems.length));

    nextTargetItems.splice(clampedIndex, 0, { ...current, date: targetDate, slot: targetSlot });

    if (!sameSlot) {
      for (let i = 0; i < sourceWithout.length; i += 1) {
        const item = sourceWithout[i];

        if (!item) continue;

        await trx
          .update(plannedItems)
          .set({ sortOrder: i, updatedAt: new Date(), version: sql`${plannedItems.version} + 1` })
          .where(eq(plannedItems.id, item.id))
          .returning();
      }
    }

    let moved: PlannedItem | null = null;

    for (let i = 0; i < nextTargetItems.length; i += 1) {
      const item = nextTargetItems[i];

      if (!item) continue;
      const updateData: PlannedItemUpdate = { sortOrder: i, updatedAt: new Date() };
      const versionIncrement = sql`${plannedItems.version} + 1`;

      if (item.id === itemId) {
        updateData.date = targetDate;
        updateData.slot = targetSlot;
      }

      const [row] = await trx
        .update(plannedItems)
        .set({ ...updateData, version: versionIncrement })
        .where(
          item.id === itemId && version
            ? and(eq(plannedItems.id, item.id), eq(plannedItems.version, version))
            : eq(plannedItems.id, item.id)
        )
        .returning();

      if (row && item.id === itemId) {
        moved = row;
      }
    }

    if (!moved) {
      return staleOutcome();
    }

    return appliedOutcome(moved);
  });
}

export async function reorderInSlot(
  updates: { id: string; sortOrder: number }[]
): Promise<PlannedItem[]> {
  if (!updates.length) return [];

  return await db.transaction(async (trx) => {
    const updated: PlannedItem[] = [];

    for (const update of updates) {
      const [row] = await trx
        .update(plannedItems)
        .set({
          sortOrder: update.sortOrder,
          updatedAt: new Date(),
          version: sql`${plannedItems.version} + 1`,
        })
        .where(eq(plannedItems.id, update.id))
        .returning();

      if (row) updated.push(row);
    }

    return updated;
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
