import type { z } from "zod";
import { TRPCError } from "@trpc/server";

import type { Slot } from "@norish/shared/contracts";
import type {
  PlannedItemDeleteInputSchema,
  PlannedItemEditInputSchema,
  PlannedItemWithRecipePayload,
} from "@norish/shared/contracts/zod";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  createPlannedItem,
  deletePlannedItem,
  editPlannedItem,
  getPlannedItemById,
  getPlannedItemWithRecipeById,
  listPlannedItemsByUserAndDateRange,
  listPlannedItemsWithRecipeBySlot,
} from "@norish/db/repositories/planned-items";
import { trpcLogger as log } from "@norish/shared-server/logger";

import type { CreateItemInput, PlannedRecipeListItem } from "./planned-items-openapi-types";
import { publishCalendarItemEvent } from "./publish";

export type CalendarProcedureContext = {
  user: { id: string };
  userIds: string[];
  householdKey: string;
};

type PlannedItemWithRecipeRow = Awaited<
  ReturnType<typeof listPlannedItemsByUserAndDateRange>
>[number];

export function buildPlannedItemPayload(
  item: Pick<
    PlannedItemWithRecipePayload,
    | "id"
    | "date"
    | "slot"
    | "sortOrder"
    | "itemType"
    | "recipeId"
    | "title"
    | "userId"
    | "version"
    | "recipeName"
    | "recipeImage"
    | "servings"
    | "calories"
  >
): PlannedItemWithRecipePayload {
  return {
    id: item.id,
    date: item.date,
    slot: item.slot,
    sortOrder: item.sortOrder,
    itemType: item.itemType,
    recipeId: item.recipeId,
    title: item.title,
    userId: item.userId,
    version: item.version,
    recipeName: item.recipeName,
    recipeImage: item.recipeImage,
    servings: item.servings,
    calories: item.calories,
  };
}

export function toPlannedRecipeListItem(item: PlannedItemWithRecipeRow): PlannedRecipeListItem {
  return {
    id: item.id,
    date: item.date,
    slot: item.slot,
    sortOrder: item.sortOrder,
    itemType: item.itemType,
    recipeId: item.recipeId,
    title: item.title,
    version: item.version,
    recipeName: item.recipeName,
    recipeImage: item.recipeImage,
    servings: item.servings,
    calories: item.calories,
  };
}

export function getServerToday() {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  return today;
}

export function startOfServerWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;

  start.setDate(start.getDate() - distanceFromMonday);
  start.setHours(0, 0, 0, 0);

  return start;
}

export function endOfServerWeek(date: Date) {
  const end = startOfServerWeek(date);

  end.setDate(end.getDate() + 6);
  end.setHours(0, 0, 0, 0);

  return end;
}

export async function listItemsByRange(
  ctx: CalendarProcedureContext,
  startISO: string,
  endISO: string
) {
  return listPlannedItemsByUserAndDateRange(ctx.userIds, startISO, endISO);
}

export async function listPlannedRecipesByRange(
  ctx: CalendarProcedureContext,
  startISO: string,
  endISO: string,
  includeNotes = false
) {
  const items = await listItemsByRange(ctx, startISO, endISO);

  return items
    .filter((item) => (item.itemType === "recipe" && item.recipeId) || includeNotes)
    .map(toPlannedRecipeListItem);
}

export async function createCalendarItem(ctx: CalendarProcedureContext, input: CreateItemInput) {
  const { id, date, slot, itemType, recipeId, title } = input;

  const newItem = await createPlannedItem({
    // Client-minted id when supplied; drizzle falls back to its default when undefined (ADR-0003).
    id,
    userId: ctx.user.id,
    date,
    slot,
    itemType,
    recipeId: recipeId ?? null,
    title: title ?? null,
  });

  const itemWithRecipe = await getPlannedItemWithRecipeById(newItem.id);
  const itemPayload = buildPlannedItemPayload({
    id: newItem.id,
    date: newItem.date,
    slot: newItem.slot,
    sortOrder: newItem.sortOrder,
    itemType: newItem.itemType,
    recipeId: newItem.recipeId,
    title: newItem.title,
    userId: newItem.userId,
    version: newItem.version,
    recipeName: itemWithRecipe?.recipeName ?? null,
    recipeImage: itemWithRecipe?.recipeImage ?? null,
    servings: itemWithRecipe?.servings ?? null,
    calories: itemWithRecipe?.calories ?? null,
  });

  await publishCalendarItemEvent("itemCreated", { item: itemPayload }, ctx.householdKey);

  // The item rides the response so the actor's own caches converge without
  // waiting on the realtime echo; the REST route's output schema keeps `id`.
  return { id: newItem.id, item: itemPayload };
}

/** The REST API answers a missing plan with 404; the app's delete of one already gone is a no-op. */
export async function deleteCalendarItem(
  ctx: CalendarProcedureContext,
  input: z.infer<typeof PlannedItemDeleteInputSchema>,
  { rejectMissing = false } = {}
) {
  const { itemId, version } = input;
  const item = await getPlannedItemById(itemId);

  if (!item && rejectMissing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Planned item not found",
    });
  }
  if (!item) return { success: true, stale: false };

  await assertHouseholdAccess(ctx.user.id, item.userId);

  const deleteResult = await deletePlannedItem(itemId, version);

  if (deleteResult.stale) {
    log.info({ userId: ctx.user.id, itemId, version }, "Ignoring stale calendar delete mutation");

    return { success: true, stale: true };
  }

  await publishCalendarItemEvent(
    "itemDeleted",
    { itemId, date: item.date, slot: item.slot },
    ctx.householdKey
  );

  return { success: true, stale: false };
}

/** Tells the household an item moved, with the order both slots now hold. */
export async function publishItemMoved(
  ctx: CalendarProcedureContext,
  from: { date: string; slot: Slot; sortOrder: number },
  item: PlannedItemWithRecipePayload
) {
  const sortOf = async (date: string, slot: Slot) =>
    (await listPlannedItemsWithRecipeBySlot(ctx.userIds, date, slot)).map(({ id, sortOrder }) => ({
      id,
      sortOrder,
    }));
  const crossSlot = from.date !== item.date || from.slot !== item.slot;

  await publishCalendarItemEvent(
    "itemMoved",
    {
      item,
      targetSlotItems: await sortOf(item.date, item.slot),
      sourceSlotItems: crossSlot ? await sortOf(from.date, from.slot) : null,
      oldDate: from.date,
      oldSlot: from.slot,
      oldSortOrder: from.sortOrder,
    },
    ctx.householdKey
  );
}

/**
 * One edit's text, day and slot under one version check and one bump; a new day or slot lands
 * last there. The household hears one event: a move carries the new text too.
 */
export async function editCalendarItem(
  ctx: CalendarProcedureContext,
  input: z.infer<typeof PlannedItemEditInputSchema>
): Promise<{ success: true; stale: boolean; item?: PlannedItemWithRecipePayload }> {
  const { itemId, version, title, date, slot } = input;
  const item = await getPlannedItemById(itemId);

  // A plan another member removed lost to an earlier write: stale, as a changed version is.
  if (!item) return { success: true, stale: true };

  await assertHouseholdAccess(ctx.user.id, item.userId);

  // A write at another version changes nothing, whatever it asks (ADR-0004).
  if (item.version !== version) {
    log.info({ userId: ctx.user.id, itemId, version }, "Ignoring stale calendar edit mutation");

    return { success: true, stale: true };
  }

  const moves = (date ?? item.date) !== item.date || (slot ?? item.slot) !== item.slot;

  if (!moves && title === undefined) return { success: true, stale: false };

  // A failure here rejects, so the client rolls back and Replay never takes it as stored.
  const result = await editPlannedItem(itemId, { title, date, slot }, version);

  if (result.stale) {
    log.info({ userId: ctx.user.id, itemId, version }, "Ignoring stale calendar edit mutation");

    return { success: true, stale: true };
  }

  const edited = await getPlannedItemWithRecipeById(result.value.id);

  // Stored all the same: no item in the answer makes the client reread.
  if (!edited) return { success: true, stale: false };

  const payload = buildPlannedItemPayload(edited);

  if (moves) await publishItemMoved(ctx, item, payload);
  else await publishCalendarItemEvent("itemUpdated", { item: payload }, ctx.householdKey);

  // The item rides the answer, as a create's does: the echo is the fast path (ADR-0011).
  return { success: true, stale: false, item: payload };
}
