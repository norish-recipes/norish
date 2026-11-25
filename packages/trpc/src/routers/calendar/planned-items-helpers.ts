import type { z } from "zod";
import { TRPCError } from "@trpc/server";

import type { Slot } from "@norish/shared/contracts";
import type {
  PlannedItemDeleteInputSchema,
  PlannedItemEditInputSchema,
  PlannedItemMoveInputSchema,
  PlannedItemWithRecipePayload,
} from "@norish/shared/contracts/zod";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  createPlannedItem,
  deletePlannedItem,
  editPlannedItem,
  getPlannedItemById,
  getPlannedItemHouseholdId,
  getPlannedItemWithRecipeById,
  listPlannedItemsByHouseholdAndDateRange,
  listPlannedItemsWithRecipeBySlot,
  moveItem,
} from "@norish/db/repositories/planned-items";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { publishCalendarItemEvent } from "@norish/shared-server/realtime/calendar-items";
import { plannedItemEditTarget } from "@norish/shared/contracts/zod";

import type { CreateItemInput, PlannedRecipeListItem } from "./planned-items-openapi-types";
import { assertRecipeAccess } from "../recipes/helpers";

export type CalendarProcedureContext = {
  user: { id: string };
  householdId: string;
};

type PlannedItemWithRecipeRow = Awaited<
  ReturnType<typeof listPlannedItemsByHouseholdAndDateRange>
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
  return listPlannedItemsByHouseholdAndDateRange(ctx.householdId, startISO, endISO);
}

export async function listPlannedRecipesByRange(
  ctx: CalendarProcedureContext,
  startISO: string,
  endISO: string,
  includeNotes = false
) {
  const items = await listItemsByRange(ctx, startISO, endISO);

  return (
    items
      // A recipe out of view stays, with its title only, as the app shows it.
      .filter((item) => item.itemType === "recipe" || includeNotes)
      .map(toPlannedRecipeListItem)
  );
}

export async function createCalendarItem(ctx: CalendarProcedureContext, input: CreateItemInput) {
  const { id, date, slot, itemType, recipeId, title } = input;

  // Only a recipe the household may view now; one out of view answers as a gone one.
  if (recipeId) await assertRecipeAccess(ctx, recipeId, "view");

  const newItem = await createPlannedItem({
    // Client-minted id when supplied; drizzle falls back to its default when undefined (ADR-0003).
    id,
    householdId: ctx.householdId,
    userId: ctx.user.id,
    date,
    slot,
    itemType,
    recipeId: recipeId ?? null,
    title: title ?? null,
  });

  const itemWithRecipe = await getPlannedItemWithRecipeById(newItem.id, ctx.householdId);
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

  await publishCalendarItemEvent("itemCreated", { item: itemPayload }, ctx.householdId);

  // The item rides the response so the actor's own caches converge without
  // waiting on the realtime echo; the REST route's output schema keeps `id`.
  return { id: newItem.id, item: itemPayload };
}

/** The household's plan entry, null when gone; another household's is refused. */
async function plannedItemOfHousehold(ctx: CalendarProcedureContext, itemId: string) {
  const householdId = await getPlannedItemHouseholdId(itemId);

  if (!householdId) return null;
  assertHouseholdAccess(ctx.householdId, householdId);

  return getPlannedItemById(itemId, ctx.householdId);
}

/** The REST API answers a missing plan with 404; the app's delete of one already gone is a no-op. */
export async function deleteCalendarItem(
  ctx: CalendarProcedureContext,
  input: z.infer<typeof PlannedItemDeleteInputSchema>,
  { rejectMissing = false } = {}
) {
  const { itemId, version } = input;
  const item = await plannedItemOfHousehold(ctx, itemId);

  if (!item && rejectMissing) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Planned item not found",
    });
  }
  if (!item) return { success: true, stale: false };

  const deleteResult = await deletePlannedItem(itemId, ctx.householdId, version);

  if (deleteResult.stale) {
    log.info({ userId: ctx.user.id, itemId, version }, "Ignoring stale calendar delete mutation");

    return { success: true, stale: true };
  }

  await publishCalendarItemEvent(
    "itemDeleted",
    { itemId, date: item.date, slot: item.slot },
    ctx.householdId
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
    (await listPlannedItemsWithRecipeBySlot(ctx.householdId, date, slot)).map(
      ({ id, sortOrder }) => ({
        id,
        sortOrder,
      })
    );
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
    ctx.householdId
  );
}

/** The plan a write names, once the member may write it; null when gone or at another version. */
async function itemAtVersion(
  ctx: CalendarProcedureContext,
  { itemId, version }: { itemId: string; version: number },
  write: "edit" | "move"
) {
  const item = await plannedItemOfHousehold(ctx, itemId);

  // A plan another member removed lost to an earlier write: stale, as a changed version is.
  if (!item) return null;

  // A write at another version changes nothing, whatever it asks (ADR-0004).
  if (item.version === version) return item;
  logStale(ctx, { itemId, version }, write);

  return null;
}

function logStale(
  ctx: CalendarProcedureContext,
  { itemId, version }: { itemId: string; version: number },
  write: "edit" | "move"
) {
  log.info({ userId: ctx.user.id, itemId, version }, `Ignoring stale calendar ${write} mutation`);
}

/** The stored item as the household hears it; null when it was removed since the write. */
async function storedPayload(ctx: CalendarProcedureContext, itemId: string) {
  const stored = await getPlannedItemWithRecipeById(itemId, ctx.householdId);

  return stored ? buildPlannedItemPayload(stored) : null;
}

/** One edit's text, day and slot under one version check and one bump; a new day or slot lands
 * last there. The household hears one event: a move carries the new text too. */
export async function editCalendarItem(
  ctx: CalendarProcedureContext,
  input: z.infer<typeof PlannedItemEditInputSchema>
): Promise<{ success: true; stale: boolean; item?: PlannedItemWithRecipePayload }> {
  const { itemId, version, title, date, slot } = input;
  const item = await itemAtVersion(ctx, input, "edit");

  if (!item) return { success: true, stale: true };

  const moves = plannedItemEditTarget(item, { date, slot }) !== undefined;

  if (!moves && title === undefined) return { success: true, stale: false };

  // A failure here rejects, so the client rolls back and Replay never takes it as stored.
  const result = await editPlannedItem(ctx.householdId, itemId, { title, date, slot }, version);

  if (result.stale) {
    logStale(ctx, input, "edit");

    return { success: true, stale: true };
  }

  const payload = await storedPayload(ctx, result.value.id);

  // Stored all the same: no item in the answer makes the client reread.
  if (!payload) return { success: true, stale: false };

  if (moves) await publishItemMoved(ctx, item, payload);
  else await publishCalendarItemEvent("itemUpdated", { item: payload }, ctx.householdId);

  // The item rides the answer, as a create's does: the echo is the fast path (ADR-0011).
  return { success: true, stale: false, item: payload };
}

/** A drag's move to a day, slot and place; no index puts it last there. */
export async function moveCalendarItem(
  ctx: CalendarProcedureContext,
  input: z.infer<typeof PlannedItemMoveInputSchema>
) {
  const { itemId, version, targetDate, targetSlot, targetIndex } = input;
  const item = await itemAtVersion(ctx, input, "move");

  if (!item) return { success: true, moved: false, stale: true };
  if (item.date === targetDate && item.slot === targetSlot && item.sortOrder === targetIndex) {
    return { success: true, moved: false, stale: false };
  }

  const result = await moveItem(
    ctx.householdId,
    itemId,
    targetDate,
    targetSlot,
    targetIndex,
    version
  );

  if (result.stale) {
    logStale(ctx, input, "move");

    return { success: true, moved: false, stale: true };
  }

  const payload = await storedPayload(ctx, result.value.id);

  // Stored all the same: no item in the answer makes the client reread.
  if (!payload) return { success: true, moved: true, stale: false };

  await publishItemMoved(ctx, item, payload);

  // The moved item rides the answer, as a create's does: the echo is the fast path (ADR-0011).
  return { success: true, moved: true, stale: false, item: payload };
}
