import type { Slot } from "@/types";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { calendarEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";
import {
  listPlannedRecipesByUsersAndRange,
  createPlannedRecipe,
  deletePlannedRecipe,
  updatePlannedRecipeDate,
  getPlannedRecipeOwnerId,
  getRecipeFull,
  PlannedRecipeListSchema,
  PlannedRecipeCreateSchema,
  PlannedRecipeDeleteSchema,
  PlannedRecipeUpdateDateSchema,
} from "@/server/db";
import { assertHouseholdAccess } from "@/server/auth/permissions";

// Procedures
const list = authedProcedure.input(PlannedRecipeListSchema).query(async ({ ctx, input }) => {
  log.debug({ userId: ctx.user.id, input }, "Listing planned recipes");

  const recipes = await listPlannedRecipesByUsersAndRange(
    ctx.userIds,
    input.startISO,
    input.endISO
  );

  log.debug({ count: recipes.length }, "Listed planned recipes");

  return recipes;
});

const create = authedProcedure.input(PlannedRecipeCreateSchema).mutation(async ({ ctx, input }) => {
  const { date, slot, recipeId } = input;
  const id = crypto.randomUUID();

  log.info({ userId: ctx.user.id, recipeId, date, slot }, "Creating planned recipe");

  try {
    const recipe = await getRecipeFull(recipeId);

    if (!recipe) {
      throw new Error("Recipe not found");
    }

    const plannedRecipe = await createPlannedRecipe(id, ctx.user.id, recipeId, date, slot);

    // Emit to household for UI updates
    calendarEmitter.emitToHousehold(ctx.householdKey, "recipePlanned", { plannedRecipe });

    // Emit global event for server-side listeners (e.g., CalDAV sync)
    calendarEmitter.emitGlobal("globalRecipePlanned", {
      id: plannedRecipe.id,
      recipeId: plannedRecipe.recipeId,
      recipeName: recipe.name,
      date: plannedRecipe.date,
      slot: plannedRecipe.slot as Slot,
      userId: ctx.user.id,
    });

    log.info({ id, userId: ctx.user.id }, "Created planned recipe");

    return id;
  } catch (error) {
    log.error({ error, userId: ctx.user.id }, "Failed to create planned recipe");
    calendarEmitter.emitToHousehold(ctx.householdKey, "failed", {
      reason: error instanceof Error ? error.message : "Failed to create planned recipe",
    });
    throw error;
  }
});

const deleteProcedure = authedProcedure
  .input(PlannedRecipeDeleteSchema)
  .mutation(async ({ ctx, input }) => {
    const { id, date } = input;

    log.info({ userId: ctx.user.id, id, date }, "Deleting planned recipe");

    try {
      const ownerId = await getPlannedRecipeOwnerId(id);

      if (!ownerId) {
        throw new Error("Planned recipe not found");
      }

      await assertHouseholdAccess(ctx.user.id, ownerId);
      await deletePlannedRecipe(id);

      // Emit to household for UI updates
      calendarEmitter.emitToHousehold(ctx.householdKey, "recipeDeleted", {
        plannedRecipeId: id,
        date,
      });

      // Emit global event for server-side listeners (e.g., CalDAV sync)
      // Use ownerId since they're the one who created the planned recipe
      calendarEmitter.emitGlobal("globalRecipeDeleted", {
        id,
        userId: ownerId,
      });

      log.info({ id, userId: ctx.user.id }, "Deleted planned recipe");

      return { success: true };
    } catch (error) {
      log.error({ error, userId: ctx.user.id, id }, "Failed to delete planned recipe");
      calendarEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: error instanceof Error ? error.message : "Failed to delete planned recipe",
      });
      throw error;
    }
  });

const updateDate = authedProcedure
  .input(PlannedRecipeUpdateDateSchema)
  .mutation(async ({ ctx, input }) => {
    const { id, newDate, oldDate } = input;

    log.info({ userId: ctx.user.id, id, newDate, oldDate }, "Updating planned recipe date");

    try {
      const ownerId = await getPlannedRecipeOwnerId(id);

      if (!ownerId) {
        throw new Error("Planned recipe not found");
      }

      await assertHouseholdAccess(ctx.user.id, ownerId);
      const plannedRecipe = await updatePlannedRecipeDate(id, newDate);

      // Emit to household for UI updates
      calendarEmitter.emitToHousehold(ctx.householdKey, "recipeUpdated", {
        plannedRecipe,
        oldDate,
      });

      // Emit global event for server-side listeners (e.g., CalDAV sync)
      // Fetch recipe name for the global event
      const recipe = await getRecipeFull(plannedRecipe.recipeId);

      calendarEmitter.emitGlobal("globalRecipeUpdated", {
        id: plannedRecipe.id,
        recipeId: plannedRecipe.recipeId,
        recipeName: recipe?.name ?? "Recipe",
        newDate: plannedRecipe.date,
        slot: plannedRecipe.slot as Slot,
        userId: ownerId,
      });

      log.info({ id, userId: ctx.user.id, newDate }, "Updated planned recipe date");

      return { success: true };
    } catch (error) {
      log.error({ error, userId: ctx.user.id, id }, "Failed to update planned recipe date");
      calendarEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: error instanceof Error ? error.message : "Failed to update planned recipe date",
      });
      throw error;
    }
  });

export const plannedRecipesProcedures = router({
  listRecipes: list,
  createRecipe: create,
  deleteRecipe: deleteProcedure,
  updateRecipeDate: updateDate,
});
