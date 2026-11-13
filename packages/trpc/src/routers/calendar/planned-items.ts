import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { SlotItemSortUpdate } from "@norish/shared/contracts/zod";
import { assertHouseholdAccess } from "@norish/auth/permissions";
import {
  getPlannedItemById,
  getPlannedItemWithRecipeById,
  listPlannedItemsWithRecipeBySlot,
  moveItem,
  updatePlannedItem,
} from "@norish/db/repositories/planned-items";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { calendar } from "@norish/shared-server/realtime/calendar";
import {
  PlannedItemDeleteInputSchema,
  PlannedItemMoveInputSchema,
  PlannedItemUpdateInputSchema,
} from "@norish/shared/contracts/zod";
import { dateKey, endOfMonth, startOfMonth } from "@norish/shared/lib/helpers";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import {
  buildPlannedItemPayload,
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
  listPlannedRecipesInput,
  plannedRecipeListItemSchema,
  plannedRecipeMutationOutputSchema,
} from "./planned-items-openapi-types";
import { publishCalendarItemEvent } from "./publish";

export const listTodayPlannedRecipesProcedure = authedProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/planned-recipes/today",
      protect: true,
      tags: ["Planned Recipes"],
      summary: "Get planned recipes for today",
      description:
        '"Today" is the day in the server\'s timezone. `include=notes` also returns planned notes.',
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .input(listPlannedRecipesInput)
  .output(z.array(plannedRecipeListItemSchema))
  .query(async ({ ctx, input }) => {
    const today = dateKey(getServerToday());

    return listPlannedRecipesByRange(ctx, today, today, input.include === "notes");
  });

export const listWeekPlannedRecipesProcedure = authedProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/planned-recipes/week",
      protect: true,
      tags: ["Planned Recipes"],
      summary: "Get planned recipes for the current week",
      description:
        "The week runs Monday through Sunday in the server's timezone. `include=notes` also returns planned notes.",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .input(listPlannedRecipesInput)
  .output(z.array(plannedRecipeListItemSchema))
  .query(async ({ ctx, input }) => {
    const today = getServerToday();

    return listPlannedRecipesByRange(
      ctx,
      dateKey(startOfServerWeek(today)),
      dateKey(endOfServerWeek(today)),
      input.include === "notes"
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
      description:
        "The month is the calendar month in the server's timezone. `include=notes` also returns planned notes.",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .input(listPlannedRecipesInput)
  .output(z.array(plannedRecipeListItemSchema))
  .query(async ({ ctx, input }) => {
    const today = getServerToday();

    return listPlannedRecipesByRange(
      ctx,
      dateKey(startOfMonth(today)),
      dateKey(endOfMonth(today)),
      input.include === "notes"
    );
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
      id: input.id,
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

    const itemPayload = buildPlannedItemPayload(movedItemWithRecipe);

    await publishCalendarItemEvent(
      "itemMoved",
      {
        item: itemPayload,
        targetSlotItems: targetSlotSortUpdates,
        sourceSlotItems: sourceSlotSortUpdates,
        oldDate: item.date,
        oldSlot: item.slot,
        oldSortOrder: item.sortOrder,
      },
      ctx.householdKey
    );

    // The moved item rides the answer, as a create's does: the echo is the fast path (ADR-0011).
    return { success: true, moved: true, stale: false, item: itemPayload };
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

        const itemPayload = buildPlannedItemPayload(itemWithRecipe);

        await publishCalendarItemEvent("itemUpdated", { item: itemPayload }, householdKey);

        return { success: true, stale: false, item: itemPayload };
      } catch (err) {
        log.error({ err, userId, itemId }, "Failed to update calendar item");
        void calendar.publish("failed", { reason: "Failed to update item" }, { householdKey });

        return { success: false };
      }
    }),
});
