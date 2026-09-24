import { TRPCError } from "@trpc/server";

import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  createPlannedItem,
  deletePlannedItem,
  getPlannedItemById,
  getPlannedItemWithRecipeById,
  listPlannedItemsByUserAndDateRange,
} from "@norish/db/repositories/planned-items";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { PlannedItemDeleteInputSchema } from "@norish/shared/contracts/zod";

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

export function toPlannedRecipeListItem(
  item: PlannedItemWithRecipeRow
): PlannedRecipeListItem | null {
  if (item.itemType !== "recipe" || !item.recipeId) {
    return null;
  }

  return {
    id: item.id,
    date: item.date,
    slot: item.slot,
    sortOrder: item.sortOrder,
    recipeId: item.recipeId,
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
  endISO: string
) {
  const items = await listItemsByRange(ctx, startISO, endISO);

  return items
    .map(toPlannedRecipeListItem)
    .filter((item): item is PlannedRecipeListItem => item !== null);
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

export async function deleteCalendarItem(
  ctx: CalendarProcedureContext,
  input: import("zod").infer<typeof PlannedItemDeleteInputSchema>
) {
  const { itemId, version } = input;
  const item = await getPlannedItemById(itemId);

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Planned item not found",
    });
  }

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
