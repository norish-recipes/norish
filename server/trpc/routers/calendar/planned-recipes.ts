import type { Slot } from "@/types";

import { TRPCError } from "@trpc/server";

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
  getAllergiesForUsers,
  getRecipeTagNames,
} from "@/server/db";
import { assertHouseholdAccess } from "@/server/auth/permissions";

async function computeAllergyWarningsForRecipe(recipeId: string, userIds: string[]) {
  const householdAllergies = await getAllergiesForUsers(userIds);
  const allAllergies = new Set(householdAllergies.map((a) => a.tagName.toLowerCase()));

  const tagNames = await getRecipeTagNames(recipeId);
  const warnings = tagNames.map((t) => t.toLowerCase()).filter((t) => allAllergies.has(t));

  return [...new Set(warnings)];
}

// Procedures
const list = authedProcedure.input(PlannedRecipeListSchema).query(async ({ ctx, input }) => {
  log.debug({ userId: ctx.user.id, input }, "Listing planned recipes");

  const recipes = await listPlannedRecipesByUsersAndRange(
    ctx.userIds,
    input.startISO,
    input.endISO
  );

  // Fetch household allergies as a flat set
  const householdAllergies = await getAllergiesForUsers(ctx.userIds);
  const allAllergies = new Set(householdAllergies.map((a) => a.tagName.toLowerCase()));

  // Get unique recipe IDs
  const recipeIds = [...new Set(recipes.map((r) => r.recipeId))];

  // Fetch tags for all recipes
  const recipeTagsMap = new Map<string, string[]>();

  for (const recipeId of recipeIds) {
    const tagNames = await getRecipeTagNames(recipeId);

    recipeTagsMap.set(
      recipeId,
      tagNames.map((t: string) => t.toLowerCase())
    );
  }

  // Compute allergy warnings for each planned recipe
  const recipesWithWarnings = recipes.map((recipe) => {
    const recipeTags = recipeTagsMap.get(recipe.recipeId) || [];
    const allergyWarnings: string[] = [];

    for (const tag of recipeTags) {
      if (allAllergies.has(tag)) {
        allergyWarnings.push(tag);
      }
    }

    return {
      ...recipe,
      allergyWarnings,
    };
  });

  log.debug({ count: recipesWithWarnings.length }, "Listed planned recipes with allergy warnings");

  return recipesWithWarnings;
});

const create = authedProcedure.input(PlannedRecipeCreateSchema).mutation(({ ctx, input }) => {
  const { date, slot, recipeId } = input;
  const id = crypto.randomUUID();

  log.info({ userId: ctx.user.id, recipeId, date, slot }, "Creating planned recipe");

  getRecipeFull(recipeId)
    .then((recipe) => {
      if (!recipe) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipe not found",
        });
      }

      return createPlannedRecipe(id, ctx.user.id, recipeId, date, slot).then((plannedRecipe) => ({
        plannedRecipe,
        recipeName: recipe.name,
      }));
    })
    .then(async ({ plannedRecipe, recipeName }) => {
      const allergyWarnings = await computeAllergyWarningsForRecipe(
        plannedRecipe.recipeId,
        ctx.userIds
      );

      // Emit to household for UI updates
      calendarEmitter.emitToHousehold(ctx.householdKey, "recipePlanned", {
        plannedRecipe: {
          ...plannedRecipe,
          allergyWarnings,
        },
      });

      // Emit global event for server-side listeners (e.g., CalDAV sync)
      calendarEmitter.emitGlobal("globalRecipePlanned", {
        id: plannedRecipe.id,
        recipeId: plannedRecipe.recipeId,
        recipeName,
        date: plannedRecipe.date,
        slot: plannedRecipe.slot as Slot,
        userId: ctx.user.id,
      });

      log.info({ id, userId: ctx.user.id }, "Created planned recipe");
    })
    .catch((error) => {
      log.error({ error, userId: ctx.user.id }, "Failed to create planned recipe");
      calendarEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: error.message || "Failed to create planned recipe",
      });
    });

  return id;
});

const deleteProcedure = authedProcedure
  .input(PlannedRecipeDeleteSchema)
  .mutation(({ ctx, input }) => {
    const { id, date } = input;

    log.info({ userId: ctx.user.id, id, date }, "Deleting planned recipe");

    getPlannedRecipeOwnerId(id)
      .then(async (ownerId) => {
        if (!ownerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Planned recipe not found",
          });
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
      })
      .catch((error) => {
        log.error({ error, userId: ctx.user.id, id }, "Failed to delete planned recipe");
        calendarEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: error.message || "Failed to delete planned recipe",
        });
      });

    return { success: true };
  });

const updateDate = authedProcedure
  .input(PlannedRecipeUpdateDateSchema)
  .mutation(({ ctx, input }) => {
    const { id, newDate, oldDate } = input;

    log.info({ userId: ctx.user.id, id, newDate, oldDate }, "Updating planned recipe date");

    getPlannedRecipeOwnerId(id)
      .then(async (ownerId) => {
        if (!ownerId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Planned recipe not found",
          });
        }

        await assertHouseholdAccess(ctx.user.id, ownerId);
        const plannedRecipe = await updatePlannedRecipeDate(id, newDate);
        const allergyWarnings = await computeAllergyWarningsForRecipe(
          plannedRecipe.recipeId,
          ctx.userIds
        );

        // Emit to household for UI updates
        calendarEmitter.emitToHousehold(ctx.householdKey, "recipeUpdated", {
          plannedRecipe: {
            ...plannedRecipe,
            allergyWarnings,
          },
          oldDate,
        });

        // Emit global event for server-side listeners (e.g., CalDAV sync)
        calendarEmitter.emitGlobal("globalRecipeUpdated", {
          id: plannedRecipe.id,
          recipeId: plannedRecipe.recipeId,
          recipeName: plannedRecipe.recipeName ?? "Recipe",
          newDate: plannedRecipe.date,
          slot: plannedRecipe.slot as Slot,
          userId: ownerId,
        });

        log.info({ id, userId: ctx.user.id, newDate }, "Updated planned recipe date");
      })
      .catch((error) => {
        log.error({ error, userId: ctx.user.id, id }, "Failed to update planned recipe date");
        calendarEmitter.emitToHousehold(ctx.householdKey, "failed", {
          reason: error.message || "Failed to update planned recipe date",
        });
      });

    return { success: true };
  });

export const plannedRecipesProcedures = router({
  listRecipes: list,
  createRecipe: create,
  deleteRecipe: deleteProcedure,
  updateRecipeDate: updateDate,
});
