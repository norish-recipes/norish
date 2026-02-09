import type { PlannedItemWithRecipePayload, SlotItemSortUpdate } from "@/server/db/zodSchemas";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

import { calendarEmitter } from "./emitter";

import { assertHouseholdAccess } from "@/server/auth/permissions";
import {
  createPlannedItem,
  deletePlannedItem,
  getPlannedItemById,
  getPlannedItemWithRecipeById,
  listPlannedItemsByUserAndDateRange,
  listPlannedItemsWithRecipeBySlot,
  moveItem,
  updatePlannedItem,
} from "@/server/db/repositories/planned-items";
import { trpcLogger as log } from "@/server/logger";

const slotSchema = z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]);
const itemTypeSchema = z.enum(["recipe", "note"]);

const listItemsInput = z.object({
  startISO: z.string(),
  endISO: z.string(),
});

const moveItemInput = z.object({
  itemId: z.string().uuid(),
  targetDate: z.string(),
  targetSlot: slotSchema,
  targetIndex: z.number().int().min(0),
});

const createItemInput = z
  .object({
    date: z.string(),
    slot: slotSchema,
    itemType: itemTypeSchema,
    recipeId: z.string().uuid().optional(),
    title: z.string().optional(),
  })
  .refine((data) => data.itemType !== "recipe" || data.recipeId, {
    message: "recipeId is required for recipe items",
  })
  .refine((data) => data.itemType !== "note" || data.title, {
    message: "title is required for note items",
  });

const deleteItemInput = z.object({
  itemId: z.string().uuid(),
});

const updateItemInput = z.object({
  itemId: z.string().uuid(),
  title: z.string().min(1),
});

export const plannedItemsProcedures = router({
  listItems: authedProcedure.input(listItemsInput).query(async ({ ctx, input }) => {
    const { startISO, endISO } = input;

    return listPlannedItemsByUserAndDateRange(ctx.userIds, startISO, endISO);
  }),

  moveItem: authedProcedure.input(moveItemInput).mutation(async ({ ctx, input }) => {
    const { itemId, targetDate, targetSlot, targetIndex } = input;

    const item = await getPlannedItemById(itemId);

    if (!item) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Planned item not found",
      });
    }

    await assertHouseholdAccess(ctx.user.id, item.userId);

    if (item.date === targetDate && item.slot === targetSlot && item.sortOrder === targetIndex) {
      return { success: true, moved: false };
    }

    const movedItem = await moveItem(itemId, targetDate, targetSlot, targetIndex);

    if (!movedItem) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to move item",
      });
    }

    const isCrossSlot = item.date !== targetDate || item.slot !== targetSlot;

    const movedItemWithRecipe = await getPlannedItemWithRecipeById(movedItem.id);

    if (!movedItemWithRecipe) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch moved item with recipe data",
      });
    }

    const targetSlotItems = await listPlannedItemsWithRecipeBySlot(
      ctx.userIds,
      targetDate,
      targetSlot
    );
    const targetSlotSortUpdates: SlotItemSortUpdate[] = targetSlotItems.map((i) => ({
      id: i.id,
      sortOrder: i.sortOrder,
    }));

    let sourceSlotSortUpdates: SlotItemSortUpdate[] | null = null;

    if (isCrossSlot) {
      const sourceSlotItems = await listPlannedItemsWithRecipeBySlot(
        ctx.userIds,
        item.date,
        item.slot
      );

      sourceSlotSortUpdates = sourceSlotItems.map((i) => ({
        id: i.id,
        sortOrder: i.sortOrder,
      }));
    }

    const itemPayload: PlannedItemWithRecipePayload = {
      id: movedItemWithRecipe.id,
      date: movedItemWithRecipe.date,
      slot: movedItemWithRecipe.slot,
      sortOrder: movedItemWithRecipe.sortOrder,
      itemType: movedItemWithRecipe.itemType,
      recipeId: movedItemWithRecipe.recipeId,
      title: movedItemWithRecipe.title,
      userId: movedItemWithRecipe.userId,
      recipeName: movedItemWithRecipe.recipeName,
      recipeImage: movedItemWithRecipe.recipeImage,
      servings: movedItemWithRecipe.servings,
      calories: movedItemWithRecipe.calories,
    };

    calendarEmitter.emitToHousehold(ctx.householdKey, "itemMoved", {
      item: itemPayload,
      targetSlotItems: targetSlotSortUpdates,
      sourceSlotItems: sourceSlotSortUpdates,
      oldDate: item.date,
      oldSlot: item.slot,
      oldSortOrder: item.sortOrder,
    });

    return { success: true, moved: true };
  }),

  createItem: authedProcedure.input(createItemInput).mutation(async ({ ctx, input }) => {
    const { date, slot, itemType, recipeId, title } = input;

    const newItem = await createPlannedItem({
      userId: ctx.user.id,
      date,
      slot,
      itemType,
      recipeId: recipeId ?? null,
      title: title ?? null,
    });

    const itemWithRecipe = await getPlannedItemWithRecipeById(newItem.id);

    const itemPayload: PlannedItemWithRecipePayload = {
      id: newItem.id,
      date: newItem.date,
      slot: newItem.slot,
      sortOrder: newItem.sortOrder,
      itemType: newItem.itemType,
      recipeId: newItem.recipeId,
      title: newItem.title,
      userId: newItem.userId,
      recipeName: itemWithRecipe?.recipeName ?? null,
      recipeImage: itemWithRecipe?.recipeImage ?? null,
      servings: itemWithRecipe?.servings ?? null,
      calories: itemWithRecipe?.calories ?? null,
    };

    calendarEmitter.emitToHousehold(ctx.householdKey, "itemCreated", {
      item: itemPayload,
    });

    return { id: newItem.id };
  }),

  deleteItem: authedProcedure.input(deleteItemInput).mutation(async ({ ctx, input }) => {
    const { itemId } = input;

    const item = await getPlannedItemById(itemId);

    if (!item) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Planned item not found",
      });
    }

    await assertHouseholdAccess(ctx.user.id, item.userId);

    await deletePlannedItem(itemId);

    calendarEmitter.emitToHousehold(ctx.householdKey, "itemDeleted", {
      itemId,
      date: item.date,
      slot: item.slot,
    });

    return { success: true };
  }),

  updateItem: authedProcedure.input(updateItemInput).mutation(async ({ ctx, input }) => {
    const { itemId, title } = input;
    const householdKey = ctx.householdKey;
    const userId = ctx.user.id;

    const item = await getPlannedItemById(itemId);

    if (!item) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Planned item not found",
      });
    }

    await assertHouseholdAccess(ctx.user.id, item.userId);

    updatePlannedItem(itemId, { title })
      .then(async (updatedItem) => {
        if (!updatedItem) {
          throw new Error("Failed to update item");
        }

        const itemWithRecipe = await getPlannedItemWithRecipeById(updatedItem.id);

        if (!itemWithRecipe) {
          throw new Error("Failed to fetch updated item");
        }

        const itemPayload: PlannedItemWithRecipePayload = {
          id: itemWithRecipe.id,
          date: itemWithRecipe.date,
          slot: itemWithRecipe.slot,
          sortOrder: itemWithRecipe.sortOrder,
          itemType: itemWithRecipe.itemType,
          recipeId: itemWithRecipe.recipeId,
          title: itemWithRecipe.title,
          userId: itemWithRecipe.userId,
          recipeName: itemWithRecipe.recipeName,
          recipeImage: itemWithRecipe.recipeImage,
          servings: itemWithRecipe.servings,
          calories: itemWithRecipe.calories,
        };

        calendarEmitter.emitToHousehold(householdKey, "itemUpdated", {
          item: itemPayload,
        });
      })
      .catch((err) => {
        log.error({ err, userId, itemId }, "Failed to update calendar item");
        calendarEmitter.emitToHousehold(householdKey, "failed", {
          reason: "Failed to update item",
        });
      });

    return { success: true };
  }),
});
