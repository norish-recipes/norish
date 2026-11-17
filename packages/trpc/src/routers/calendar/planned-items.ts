import { z } from "zod";

import {
  PlannedItemDeleteInputSchema,
  PlannedItemEditInputSchema,
  PlannedItemMoveInputSchema,
} from "@norish/shared/contracts/zod";
import { dateKey, endOfMonth, startOfMonth } from "@norish/shared/lib/helpers";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import {
  createCalendarItem,
  deleteCalendarItem,
  editCalendarItem,
  endOfServerWeek,
  getServerToday,
  listItemsByRange,
  listPlannedRecipesByRange,
  moveCalendarItem,
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
  .mutation(async ({ ctx, input }) => deleteCalendarItem(ctx, input, { rejectMissing: true }));

export const plannedItemsProcedures = router({
  listItems: authedProcedure.input(listItemsInput).query(async ({ ctx, input }) => {
    const { startISO, endISO } = input;

    return listItemsByRange(ctx, startISO, endISO);
  }),

  moveItem: authedProcedure
    .input(PlannedItemMoveInputSchema)
    .mutation(async ({ ctx, input }) => moveCalendarItem(ctx, input)),

  createItem: authedProcedure.input(createItemInput).mutation(async ({ ctx, input }) => {
    return createCalendarItem(ctx, input);
  }),

  deleteItem: authedProcedure
    .input(PlannedItemDeleteInputSchema)
    .mutation(async ({ ctx, input }) => {
      return deleteCalendarItem(ctx, input);
    }),

  editItem: authedProcedure
    .input(PlannedItemEditInputSchema)
    .mutation(async ({ ctx, input }) => editCalendarItem(ctx, input)),
});
