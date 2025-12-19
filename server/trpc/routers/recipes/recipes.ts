import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";
import { emitByPolicy } from "../../helpers";

import { recipeEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";
import {
  listRecipes,
  getRecipeFull,
  getRecipeOwnerId,
  createRecipeWithRefs,
  updateRecipeWithRefs,
  deleteRecipeById,
  dashboardRecipe,
  setActiveSystemForRecipe,
  addStepsAndIngredientsToRecipeByInput,
  searchRecipesByName,
  FullRecipeInsertSchema,
  RecipeListInputSchema,
  RecipeGetInputSchema,
  RecipeDeleteInputSchema,
  RecipeImportInputSchema,
  RecipeConvertInputSchema,
  RecipeUpdateInputSchema,
  type RecipeListContext,
} from "@/server/db";
import {
  canAccessResource,
  isAIEnabled as checkAIEnabled,
  type PermissionAction,
} from "@/server/auth/permissions";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";
import {
  addImportJob,
  addImageImportJob,
  addPasteImportJob,
  addNutritionEstimationJob,
} from "@/server/queue";
import { FilterMode, SortOrder } from "@/types";
import { MAX_RECIPE_PASTE_CHARS } from "@/types/uploads";

interface UserContext {
  user: { id: string };
  householdUserIds: string[] | null;
  householdKey: string;
  isServerAdmin: boolean;
}

/**
 * Emit a failure event based on the view policy
 */
async function emitFailure(
  ctx: UserContext,
  reason: string,
  meta?: { recipeId?: string; url?: string }
): Promise<void> {
  const policy = await getRecipePermissionPolicy();

  emitByPolicy(
    recipeEmitter,
    policy.view,
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "failed",
    { reason, ...meta }
  );
}

/**
 * Handle async operation errors with logging and household notification
 */
function handleError(
  ctx: UserContext,
  err: unknown,
  operation: string,
  meta?: { recipeId?: string; url?: string }
): void {
  const error = err as Error;

  log.error({ err: error, userId: ctx.user.id, ...meta }, `Failed to ${operation}`);
  emitFailure(ctx, error.message || `Failed to ${operation}`, meta);
}

/**
 * Check if user can perform an action on a recipe.
 * Returns true if allowed, throws FORBIDDEN if not.
 * Orphaned recipes (no owner) allow any action.
 */
async function assertRecipeAccess(
  ctx: UserContext,
  recipeId: string,
  action: PermissionAction
): Promise<void> {
  const ownerId = await getRecipeOwnerId(recipeId);

  if (ownerId === null) {
    // Orphaned recipe - anyone can access
    log.debug({ recipeId }, `${action} orphaned recipe`);

    return;
  }

  const canAccess = await canAccessResource(
    action,
    ctx.user.id,
    ownerId,
    ctx.householdUserIds,
    ctx.isServerAdmin
  );

  if (!canAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this recipe",
    });
  }
}

// Procedures
const list = authedProcedure.input(RecipeListInputSchema).query(async ({ ctx, input }) => {
  const { cursor, limit, search, tags, filterMode, sortMode, minRating } = input;

  log.debug({ userId: ctx.user.id, cursor, limit }, "Listing recipes");

  const listCtx: RecipeListContext = {
    userId: ctx.user.id,
    householdUserIds: ctx.householdUserIds,
    isServerAdmin: ctx.isServerAdmin,
  };

  const result = await listRecipes(
    listCtx,
    limit,
    cursor,
    search,
    tags,
    filterMode as FilterMode,
    sortMode as SortOrder,
    minRating
  );

  log.debug({ count: result.recipes.length, total: result.total }, "Listed recipes");

  return {
    recipes: result.recipes,
    total: result.total,
    nextCursor: cursor + limit < result.total ? cursor + limit : null,
  };
});

const get = authedProcedure.input(RecipeGetInputSchema).query(async ({ ctx, input }) => {
  log.debug({ userId: ctx.user.id, recipeId: input.id }, "Getting recipe");

  const recipe = await getRecipeFull(input.id);

  if (!recipe) {
    return null;
  }

  // Check view permission if recipe has an owner
  if (recipe.userId) {
    const canView = await canAccessResource(
      "view",
      ctx.user.id,
      recipe.userId,
      ctx.householdUserIds,
      ctx.isServerAdmin
    );

    if (!canView) {
      log.warn({ userId: ctx.user.id, recipeId: input.id }, "Access denied to recipe");

      return null;
    }
  }

  return recipe;
});

const create = authedProcedure.input(FullRecipeInsertSchema).mutation(({ ctx, input }) => {
  const recipeId = input.id ?? crypto.randomUUID();

  log.info(
    { userId: ctx.user.id, recipeName: input.name, recipeId, providedId: input.id },
    "Creating recipe"
  );
  log.debug({ recipe: input }, "Full recipe data");

  if (input.id && input.id !== recipeId) {
    log.error({ inputId: input.id, generatedId: recipeId }, "Recipe ID mismatch detected!");
  }

  createRecipeWithRefs(recipeId, ctx.user.id, input)
    .then(async (createdId) => {
      if (!createdId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create recipe",
        });
      }

      const dashboardDto = await dashboardRecipe(createdId);

      if (dashboardDto) {
        log.info({ userId: ctx.user.id, recipeId: createdId }, "Recipe created");
        const policy = await getRecipePermissionPolicy();

        emitByPolicy(
          recipeEmitter,
          policy.view,
          { userId: ctx.user.id, householdKey: ctx.householdKey },
          "created",
          { recipe: dashboardDto }
        );
      }
    })
    .catch((err) => handleError(ctx, err, "create recipe", { recipeId }));

  return recipeId;
});

const update = authedProcedure.input(RecipeUpdateInputSchema).mutation(({ ctx, input }) => {
  const { id, data } = input;

  log.info({ userId: ctx.user.id, recipeId: id }, "Updating recipe");
  log.debug({ recipe: input }, "Full recipe data");

  assertRecipeAccess(ctx, id, "edit")
    .then(async () => {
      await updateRecipeWithRefs(id, ctx.user.id, data);

      const updatedRecipe = await getRecipeFull(id);

      if (updatedRecipe) {
        log.info({ userId: ctx.user.id, recipeId: id }, "Recipe updated");
        const policy = await getRecipePermissionPolicy();

        emitByPolicy(
          recipeEmitter,
          policy.view,
          { userId: ctx.user.id, householdKey: ctx.householdKey },
          "updated",
          { recipe: updatedRecipe }
        );
      }
    })
    .catch((err) => handleError(ctx, err, "update recipe", { recipeId: id }));

  return { success: true };
});

const deleteProcedure = authedProcedure
  .input(RecipeDeleteInputSchema)
  .mutation(({ ctx, input }) => {
    const { id } = input;

    log.info({ userId: ctx.user.id, recipeId: id }, "Deleting recipe");

    assertRecipeAccess(ctx, id, "delete")
      .then(async () => {
        await deleteRecipeById(id);

        log.info({ userId: ctx.user.id, recipeId: id }, "Recipe deleted");
        const policy = await getRecipePermissionPolicy();

        emitByPolicy(
          recipeEmitter,
          policy.view,
          { userId: ctx.user.id, householdKey: ctx.householdKey },
          "deleted",
          { id }
        );
      })
      .catch((err) => handleError(ctx, err, "delete recipe", { recipeId: id }));

    return { success: true };
  });

const importFromUrlProcedure = authedProcedure
  .input(RecipeImportInputSchema.extend({ forceAI: z.boolean().optional() }))
  .mutation(async ({ ctx, input }) => {
    const { url, forceAI } = input;
    const recipeId = crypto.randomUUID();

    // Add job to queue - returns conflict status if duplicate in queue
    const result = await addImportJob({
      url,
      recipeId,
      userId: ctx.user.id,
      householdKey: ctx.householdKey,
      householdUserIds: ctx.householdUserIds,
      forceAI,
    });

    if (result.status === "exists" || result.status === "duplicate") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This recipe is already exist or is being imported",
      });
    }

    return recipeId;
  });

const reserveId = authedProcedure.query(() => {
  const recipeId = crypto.randomUUID();

  log.debug({ recipeId }, "Reserved recipe ID for step image uploads");

  return { recipeId };
});

const convertMeasurements = authedProcedure
  .input(RecipeConvertInputSchema)
  .mutation(({ ctx, input }) => {
    const { recipeId, targetSystem } = input;

    log.info({ userId: ctx.user.id, recipeId, targetSystem }, "Converting recipe measurements");

    checkAIEnabled()
      .then((aiEnabled) => {
        if (!aiEnabled) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "AI features are disabled",
          });
        }

        return getRecipeFull(recipeId);
      })
      .then((recipe) => {
        if (!recipe) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Recipe not found",
          });
        }

        if (recipe.recipeIngredients.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Recipe has no ingredients to convert",
          });
        }

        // Check edit permission (uses recipe.userId directly since we have the full recipe)
        const permissionCheck = recipe.userId
          ? canAccessResource(
              "edit",
              ctx.user.id,
              recipe.userId,
              ctx.householdUserIds,
              ctx.isServerAdmin
            )
          : Promise.resolve(true);

        return permissionCheck.then((canEdit) => {
          if (!canEdit) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "You do not have permission to edit this recipe",
            });
          }

          return recipe;
        });
      })
      .then((recipe) => {
        // Check if already converted (has ingredients with target system)
        if (recipe.recipeIngredients.some((ri) => ri.systemUsed === targetSystem)) {
          return setActiveSystemForRecipe(recipe.id, targetSystem).then(async () => {
            const policy = await getRecipePermissionPolicy();

            emitByPolicy(
              recipeEmitter,
              policy.view,
              { userId: ctx.user.id, householdKey: ctx.householdKey },
              "converted",
              { recipe: { ...recipe, systemUsed: targetSystem } }
            );

            return null; // Signal to stop chain
          });
        }

        return recipe;
      })
      .then((recipe) => {
        if (recipe === null) return null;

        // Convert with AI
        return import("@/server/ai/unit-converter")
          .then(({ convertRecipeDataWithAI }) => convertRecipeDataWithAI(recipe, targetSystem))
          .then((converted) => {
            if (!converted) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Conversion failed, please try again.",
              });
            }

            return { recipe, converted };
          });
      })
      .then((result) => {
        if (result === null) return;

        const { recipe, converted } = result;

        const steps = converted.steps.map((s) => ({
          ...s,
          recipeId: recipe.id,
          systemUsed: targetSystem,
        }));

        const ingredients = converted.ingredients.map((i) => ({
          ...i,
          recipeId: recipe.id,
          systemUsed: targetSystem,
        }));

        return addStepsAndIngredientsToRecipeByInput(steps, ingredients)
          .then(() => setActiveSystemForRecipe(recipe.id, targetSystem))
          .then(() => getRecipeFull(recipe.id))
          .then(async (updatedRecipe) => {
            if (updatedRecipe) {
              log.info({ userId: ctx.user.id, recipeId }, "Recipe measurements converted");
              const policy = await getRecipePermissionPolicy();

              emitByPolicy(
                recipeEmitter,
                policy.view,
                { userId: ctx.user.id, householdKey: ctx.householdKey },
                "converted",
                { recipe: { ...updatedRecipe, systemUsed: targetSystem } }
              );
            }
          });
      })
      .catch((err) => handleError(ctx, err, "convert recipe measurements", { recipeId }));

    return { success: true };
  });

const autocomplete = authedProcedure
  .input(z.object({ query: z.string().min(1).max(100) }))
  .query(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, query: input.query }, "Searching recipes for autocomplete");

    const listCtx: RecipeListContext = {
      userId: ctx.user.id,
      householdUserIds: ctx.householdUserIds,
      isServerAdmin: ctx.isServerAdmin,
    };

    const results = await searchRecipesByName(listCtx, input.query, 10);

    return results;
  });

const importFromImagesProcedure = authedProcedure
  .input(z.instanceof(FormData))
  .mutation(async ({ ctx, input }) => {
    const files: Array<{ data: string; mimeType: string; filename: string }> = [];

    // Process files from FormData
    for (const [key, value] of input.entries()) {
      if (key.startsWith("file") && value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        const base64 = buffer.toString("base64");

        files.push({
          data: base64,
          mimeType: value.type,
          filename: value.name,
        });
      }
    }

    if (files.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No files provided",
      });
    }

    const recipeId = crypto.randomUUID();

    log.info(
      { userId: ctx.user.id, fileCount: files.length, recipeId },
      "Processing image import request"
    );

    const result = await addImageImportJob({
      recipeId,
      userId: ctx.user.id,
      householdKey: ctx.householdKey,
      householdUserIds: ctx.householdUserIds,
      files,
    });

    if (result.status === "duplicate") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This import is already in progress",
      });
    }

    return recipeId;
  });

const importFromPasteProcedure = authedProcedure
  .input(
    z.object({
      text: z.string().min(1).max(MAX_RECIPE_PASTE_CHARS),
      forceAI: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const recipeId = crypto.randomUUID();

    log.info(
      { userId: ctx.user.id, recipeId, textLength: input.text.length },
      "Processing paste import request"
    );

    const result = await addPasteImportJob({
      recipeId,
      userId: ctx.user.id,
      householdKey: ctx.householdKey,
      householdUserIds: ctx.householdUserIds,
      text: input.text,
      forceAI: input.forceAI,
    });

    if (result.status === "duplicate") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This import is already in progress",
      });
    }

    return recipeId;
  });

const estimateNutrition = authedProcedure
  .input(z.object({ recipeId: z.uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { recipeId } = input;

    log.info({ userId: ctx.user.id, recipeId }, "Queueing nutrition estimation for recipe");

    const aiEnabled = await checkAIEnabled();

    if (!aiEnabled) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "AI features are disabled",
      });
    }

    const recipe = await getRecipeFull(recipeId);

    if (!recipe) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Recipe not found",
      });
    }

    if (recipe.recipeIngredients.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Recipe has no ingredients to estimate from",
      });
    }

    // Add to queue for background processing
    const result = await addNutritionEstimationJob({
      recipeId,
      userId: ctx.user.id,
      householdKey: ctx.householdKey,
      householdUserIds: ctx.householdUserIds,
    });

    if (result.status === "duplicate") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Nutrition estimation is already in progress for this recipe",
      });
    }

    const policy = await getRecipePermissionPolicy();

    emitByPolicy(
      recipeEmitter,
      policy.view,
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "nutritionStarted",
      { recipeId }
    );

    return { success: true };
  });

export const recipesProcedures = router({
  list,
  get,
  create,
  update,
  delete: deleteProcedure,
  importFromUrl: importFromUrlProcedure,
  importFromImages: importFromImagesProcedure,
  importFromPaste: importFromPasteProcedure,
  convertMeasurements,
  estimateNutrition,
  reserveId,
  autocomplete,
});
