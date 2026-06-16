import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type {
  PlannedItemWithRecipePayload,
  SlotItemSortUpdate,
} from "@norish/shared/contracts/zod";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  getPlannedItemById,
  getPlannedItemWithRecipeById,
  listPlannedItemsWithRecipeBySlot,
  moveItem,
  updatePlannedItem,
} from "@norish/db/repositories/planned-items";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  PlannedItemDeleteInputSchema,
  PlannedItemMoveInputSchema,
  PlannedItemUpdateInputSchema,
} from "@norish/shared/contracts/zod";
import { dateKey, endOfMonth, startOfMonth } from "@norish/shared/lib/helpers";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { calendarEmitter } from "./emitter";
import {
  createCalendarItem,
  deleteCalendarItem,
  endOfServerWeek,
  getServerToday,
  listItemsByRange,
  listPlannedRecipesByRange,
  startOfServerWeek,
} from "./planned-items-helpers";
import {
  createItemInput,
  createPlannedRecipeInputSchema,
  deletePlannedRecipeOutputSchema,
  listItemsInput,
  plannedRecipeListItemSchema,
  plannedRecipeMutationOutputSchema,
} from "./planned-items-openapi-types";

export const listTodayPlannedRecipesProcedure = authedProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/planned-recipes/today",
      protect: true,
      tags: ["Planned Recipes"],
      summary: "Get planned recipes for today",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .output(z.array(plannedRecipeListItemSchema))
  .query(async ({ ctx }) => {
    const today = dateKey(getServerToday());

    return listPlannedRecipesByRange(ctx, today, today);
  });

export const listWeekPlannedRecipesProcedure = authedProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/planned-recipes/week",
      protect: true,
      tags: ["Planned Recipes"],
      summary: "Get planned recipes for the current week",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .output(z.array(plannedRecipeListItemSchema))
  .query(async ({ ctx }) => {
    const today = getServerToday();

    return listPlannedRecipesByRange(
      ctx,
      dateKey(startOfServerWeek(today)),
      dateKey(endOfServerWeek(today))
    );
  });

export const listMonthPlannedRecipesProcedure = authedProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/planned-recipes/month",
      protect: true,
      tags: ["Planned Recipes"],
      summary: "Get planned recipes for the current month",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .output(z.array(plannedRecipeListItemSchema))
  .query(async ({ ctx }) => {
    const today = getServerToday();

    return listPlannedRecipesByRange(ctx, dateKey(startOfMonth(today)), dateKey(endOfMonth(today)));
  });

export const createPlannedRecipeProcedure = authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/planned-recipes",
      protect: true,
      tags: ["Planned Recipes"],
      summary: "Create a planned recipe",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .input(createPlannedRecipeInputSchema)
  .output(plannedRecipeMutationOutputSchema)
  .mutation(async ({ ctx, input }) => {
    return createCalendarItem(ctx, {
      date: input.date,
      slot: input.slot,
      itemType: "recipe",
      recipeId: input.recipeId,
    });
  });

export const deletePlannedRecipeProcedure = authedProcedure
  .meta({
    openapi: {
      method: "DELETE",
      path: "/planned-recipes/{itemId}",
      protect: true,
      tags: ["Planned Recipes"],
      summary: "Delete a planned recipe",
      errorResponses: {
        401: "Missing or invalid API credentials",
        404: "Planned item not found",
      },
    },
  })
  .input(PlannedItemDeleteInputSchema)
  .output(deletePlannedRecipeOutputSchema)
  .mutation(async ({ ctx, input }) => deleteCalendarItem(ctx, input));

export const plannedItemsProcedures = router({
  listItems: authedProcedure.input(listItemsInput).query(async ({ ctx, input }) => {
    const { startISO, endISO } = input;

    return listItemsByRange(ctx, startISO, endISO);
  }),

  moveItem: authedProcedure.input(PlannedItemMoveInputSchema).mutation(async ({ ctx, input }) => {
    const { itemId, targetDate, targetSlot, targetIndex, version } = input;

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

    const moveResult = await moveItem(itemId, targetDate, targetSlot, targetIndex, version);

    if (moveResult.stale) {
      log.info({ userId: ctx.user.id, itemId, version }, "Ignoring stale calendar move mutation");

      return { success: true, moved: false, stale: true };
    }

    const movedItem = moveResult.value;

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
      version: movedItemWithRecipe.version,
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

    return { success: true, moved: true, stale: false };
  }),

  createItem: authedProcedure.input(createItemInput).mutation(async ({ ctx, input }) => {
    return createCalendarItem(ctx, input);
  }),

  deleteItem: authedProcedure
    .input(PlannedItemDeleteInputSchema)
    .mutation(async ({ ctx, input }) => {
      return deleteCalendarItem(ctx, input);
    }),

  updateItem: authedProcedure
    .input(PlannedItemUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { itemId, title, version } = input;
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

      try {
        const updateResult = await updatePlannedItem(itemId, { title }, version);

        if (updateResult.stale) {
          log.info({ userId, itemId, version }, "Ignoring stale calendar update mutation");

          return { success: true, stale: true };
        }

        const itemWithRecipe = await getPlannedItemWithRecipeById(updateResult.value.id);

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
          version: itemWithRecipe.version,
          recipeName: itemWithRecipe.recipeName,
          recipeImage: itemWithRecipe.recipeImage,
          servings: itemWithRecipe.servings,
          calories: itemWithRecipe.calories,
        };

        calendarEmitter.emitToHousehold(householdKey, "itemUpdated", {
          item: itemPayload,
        });

        return { success: true, stale: false };
      } catch (err) {
        log.error({ err, userId, itemId }, "Failed to update calendar item");
        calendarEmitter.emitToHousehold(householdKey, "failed", {
          reason: "Failed to update item",
        });

        return { success: false };
      }
    }),
});
