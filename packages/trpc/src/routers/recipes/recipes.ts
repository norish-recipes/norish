import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { RecipeListContext } from "@norish/db";
import { canAccessResource, isAIEnabled as checkAIEnabled } from "@norish/auth/permissions";
import { getRecipePermissionPolicy } from "@norish/config/server-config-loader";
import {
  addStepsAndIngredientsToRecipeByInput,
  createRecipeWithRefs,
  dashboardRecipe,
  deleteRecipeById,
  FullRecipeInsertSchema,
  getRandomRecipeCandidates,
  getRecipeFull,
  listRecipes,
  RecipeConvertInputSchema,
  RecipeDeleteInputSchema,
  RecipeGetInputSchema,
  RecipeImportInputSchema,
  RecipeListInputSchema,
  RecipeUpdateInputSchema,
  searchRecipesByName,
  setActiveSystemForRecipe,
  updateRecipeCategories,
  updateRecipeWithRefs,
} from "@norish/db";
import {
  addAllergyDetectionJob,
  addAutoCategorizationJob,
  addAutoTaggingJob,
  addImageImportJob,
  addImportJob,
  addNutritionEstimationJob,
  addPasteImportJob,
  preparePasteImport,
} from "@norish/queue";
import { getQueues } from "@norish/queue/registry";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";
import { selectWeightedRandomRecipe } from "@norish/shared-server/recipes/randomizer";
import { FilterMode, RecipeCategory, SortOrder } from "@norish/shared/contracts";
import { FullRecipeSchema, RecipeListResultSchema } from "@norish/shared/contracts/zod";

import { emitByPolicy } from "../../helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { recipeEmitter } from "./emitter";
import { assertRecipeAccess, findRecipeForViewer, handleRecipeError } from "./helpers";
import {
  randomRecipeInputSchema,
  recipeAutocompleteInputSchema,
  recipeIdInputSchema,
  recipeImportPasteInputSchema,
  recipeImportPasteOutputSchema,
} from "./recipes-openapi-types";

// Procedures
export const listProcedure = authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/recipes/search",
      protect: true,
      tags: ["Recipes"],
      summary: "List recipes",
      description:
        "Returns a paginated list of recipes. All filter fields are optional, so you can omit them to fetch the default recipe list.",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .input(RecipeListInputSchema)
  .output(RecipeListResultSchema)
  .query(async ({ ctx, input }) => {
    const {
      cursor,
      limit,
      search,
      searchFields,
      tags,
      filterMode,
      sortMode,
      minRating,
      maxCookingTime,
      categories,
    } = input;

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
      searchFields,
      tags,
      filterMode as FilterMode,
      sortMode as SortOrder,
      minRating,
      maxCookingTime,
      categories
    );

    log.debug({ count: result.recipes.length, total: result.total }, "Listed recipes");

    return {
      recipes: result.recipes,
      total: result.total,
      nextCursor: cursor + limit < result.total ? cursor + limit : null,
    };
  });

export const getProcedure = authedProcedure
  .meta({
    openapi: {
      method: "GET",
      path: "/recipes/{id}",
      protect: true,
      tags: ["Recipes"],
      summary: "Get a recipe by ID",
      errorResponses: {
        401: "Missing or invalid API credentials",
        404: "Recipe not found",
      },
    },
  })
  .input(RecipeGetInputSchema)
  .output(FullRecipeSchema)
  .query(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, recipeId: input.id }, "Getting recipe");

    const recipe = await findRecipeForViewer(ctx, input.id);

    if (!recipe) {
      log.warn({ userId: ctx.user.id, recipeId: input.id }, "Recipe not found or not accessible");

      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
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
    .catch((err) => handleRecipeError(ctx, err, "create recipe", { recipeId }));

  return recipeId;
});

const update = authedProcedure.input(RecipeUpdateInputSchema).mutation(({ ctx, input }) => {
  const { id, data, version } = input;

  log.info({ userId: ctx.user.id, recipeId: id }, "Updating recipe");
  log.debug({ recipe: input }, "Full recipe data");

  assertRecipeAccess(ctx, id, "edit")
    .then(async () => {
      const result = await updateRecipeWithRefs(id, ctx.user.id, data, version);

      if (result.stale) {
        log.info({ userId: ctx.user.id, recipeId: id, version }, "Ignoring stale recipe update");
        return;
      }

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
    .catch((err) => handleRecipeError(ctx, err, "update recipe", { recipeId: id }));

  return { success: true };
});

const updateCategories = authedProcedure
  .input(
    z.object({
      recipeId: z.string().uuid(),
      version: z.number().int().positive(),
      categories: z.array(z.enum(["Breakfast", "Lunch", "Dinner", "Snack"])),
    })
  )
  .mutation(async ({ ctx, input }) => {
    await assertRecipeAccess(ctx, input.recipeId, "edit");

    const result = await updateRecipeCategories(
      input.recipeId,
      input.categories as RecipeCategory[],
      input.version
    );

    if (result.stale) {
      log.info(
        { userId: ctx.user.id, recipeId: input.recipeId, version: input.version },
        "Ignoring stale recipe category update"
      );
      return { success: true, stale: true };
    }

    const updated = await getRecipeFull(input.recipeId);

    if (updated) {
      const policy = await getRecipePermissionPolicy();

      emitByPolicy(
        recipeEmitter,
        policy.view,
        { userId: ctx.user.id, householdKey: ctx.householdKey },
        "updated",
        { recipe: updated }
      );
    }

    return { success: true };
  });

const deleteProcedure = authedProcedure
  .input(RecipeDeleteInputSchema)
  .mutation(({ ctx, input }) => {
    const { id, version } = input;

    log.info({ userId: ctx.user.id, recipeId: id }, "Deleting recipe");

    assertRecipeAccess(ctx, id, "delete")
      .then(async () => {
        await deleteRecipeImagesDir(id);
        const result = await deleteRecipeById(id, version);

        if (result.stale) {
          log.info({ userId: ctx.user.id, recipeId: id, version }, "Ignoring stale recipe delete");
          return;
        }

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
      .catch((err) => handleRecipeError(ctx, err, "delete recipe", { recipeId: id }));

    return { success: true };
  });

export const importFromUrlProcedure = authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/recipes/import/url",
      protect: true,
      tags: ["Recipe Imports"],
      summary: "Queue a recipe import from a URL",
      errorResponses: {
        401: "Missing or invalid API credentials",
        409: "This recipe already exists or is being imported",
      },
    },
  })
  .input(RecipeImportInputSchema.extend({ forceAI: z.boolean().optional() }))
  .output(z.uuid())
  .mutation(async ({ ctx, input }) => {
    const { url, forceAI } = input;
    const recipeId = crypto.randomUUID();

    // Add job to queue - returns conflict status if duplicate in queue
    const queues = getQueues();
    const result = await addImportJob(queues.recipeImport, {
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
        message: "This recipe already exists or is being imported",
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
    const { recipeId, targetSystem, version } = input;

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
          return setActiveSystemForRecipe(recipe.id, targetSystem, version).then(async (result) => {
            if (result.stale) {
              log.info(
                { userId: ctx.user.id, recipeId, version },
                "Ignoring stale recipe conversion"
              );
              return null;
            }

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
        return import("@norish/shared-server/ai/unit-converter")
          .then(({ convertRecipeDataWithAI }) => convertRecipeDataWithAI(recipe, targetSystem))
          .then((result) => {
            if (!result.success) {
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: result.error ?? "Conversion failed, please try again.",
              });
            }

            return { recipe, converted: result.data };
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
          .then(() => setActiveSystemForRecipe(recipe.id, targetSystem, version))
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
      .catch((err) => handleRecipeError(ctx, err, "convert recipe measurements", { recipeId }));

    return { success: true };
  });

const autocomplete = authedProcedure
  .input(recipeAutocompleteInputSchema)
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

const getRandomRecipe = authedProcedure
  .input(randomRecipeInputSchema)
  .query(async ({ ctx, input }) => {
    const listCtx: RecipeListContext = {
      userId: ctx.user.id,
      householdUserIds: ctx.householdUserIds,
      isServerAdmin: ctx.isServerAdmin,
    };

    let candidates = await getRandomRecipeCandidates(listCtx, input.category);

    if (candidates.length <= 1 && input.category) {
      candidates = await getRandomRecipeCandidates(listCtx, undefined);
    }

    const selected = selectWeightedRandomRecipe(candidates);

    if (!selected) {
      return null;
    }

    return { id: selected.id, name: selected.name, image: selected.image };
  });

const importFromImagesProcedure = authedProcedure
  .input(z.instanceof(FormData))
  .mutation(async ({ ctx, input }) => {
    const files: Array<{ data: string; mimeType: string; filename: string }> = [];

    // Process files from FormData
    const filePromises: Promise<void>[] = [];

    input.forEach((value, key) => {
      if (!key.startsWith("file") || !(value instanceof File)) {
        return;
      }

      filePromises.push(
        value.arrayBuffer().then((arrayBuffer) => {
          const buffer = Buffer.from(arrayBuffer);

          files.push({
            data: buffer.toString("base64"),
            mimeType: value.type,
            filename: value.name,
          });
        })
      );
    });

    await Promise.all(filePromises);

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

    const queues = getQueues();
    const result = await addImageImportJob(queues.imageImport, {
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

export const importFromPasteProcedure = authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/recipes/import/paste",
      protect: true,
      tags: ["Recipe Imports"],
      summary: "Queue a recipe import from pasted text",
      errorResponses: {
        401: "Missing or invalid API credentials",
        409: "This import is already in progress",
      },
    },
  })
  .input(recipeImportPasteInputSchema)
  .output(recipeImportPasteOutputSchema)
  .mutation(async ({ ctx, input }) => {
    const preparedImport = await preparePasteImport(input.text, input.forceAI);

    log.info(
      { userId: ctx.user.id, recipeIds: preparedImport.recipeIds, textLength: input.text.length },
      "Processing paste import request"
    );

    const queues = getQueues();
    const result = await addPasteImportJob(queues.pasteImport, {
      ...preparedImport,
      userId: ctx.user.id,
      householdKey: ctx.householdKey,
      householdUserIds: ctx.householdUserIds,
    });

    if (result.status === "duplicate") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This import is already in progress",
      });
    }

    return { recipeIds: preparedImport.recipeIds };
  });

const estimateNutrition = authedProcedure
  .input(recipeIdInputSchema)
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
    const queues = getQueues();
    const result = await addNutritionEstimationJob(queues.nutritionEstimation, {
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

const triggerAutoTag = authedProcedure
  .input(recipeIdInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { recipeId } = input;

    log.info({ userId: ctx.user.id, recipeId }, "Queueing auto-tagging for recipe");

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
        message: "Recipe has no ingredients to generate tags from",
      });
    }

    // Add to queue for background processing
    const queues = getQueues();
    const result = await addAutoTaggingJob(queues.autoTagging, {
      recipeId,
      userId: ctx.user.id,
      householdKey: ctx.householdKey,
    });

    if (result.status === "duplicate") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Auto-tagging is already in progress for this recipe",
      });
    }

    if (result.status === "skipped") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Auto-tagging is disabled",
      });
    }

    const policy = await getRecipePermissionPolicy();

    emitByPolicy(
      recipeEmitter,
      policy.view,
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "autoTaggingStarted",
      { recipeId }
    );

    return { success: true };
  });

const triggerAutoCategorize = authedProcedure
  .input(recipeIdInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { recipeId } = input;

    log.info({ userId: ctx.user.id, recipeId }, "Queueing auto-categorization for recipe");

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
        message: "Recipe has no ingredients to generate categories from",
      });
    }

    const queues = getQueues();
    const result = await addAutoCategorizationJob(queues.autoCategorization, {
      recipeId,
      userId: ctx.user.id,
      householdKey: ctx.householdKey,
    });

    if (result.status === "duplicate") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Auto-categorization is already in progress for this recipe",
      });
    }

    if (result.status === "skipped") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Auto-categorization is disabled",
      });
    }

    return { success: true };
  });

const triggerAllergyDetection = authedProcedure
  .input(recipeIdInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { recipeId } = input;

    log.info({ userId: ctx.user.id, recipeId }, "Queueing allergy detection for recipe");

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
        message: "Recipe has no ingredients to detect allergies from",
      });
    }

    // Add to queue for background processing
    const queues = getQueues();
    const result = await addAllergyDetectionJob(queues.allergyDetection, {
      recipeId,
      userId: ctx.user.id,
      householdKey: ctx.householdKey,
    });

    if (result.status === "duplicate") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Allergy detection is already in progress for this recipe",
      });
    }

    if (result.status === "skipped") {
      const reasonMessage =
        result.reason === "no_allergies"
          ? "No allergies configured for your household"
          : "Allergy detection is disabled";

      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: reasonMessage,
      });
    }

    const policy = await getRecipePermissionPolicy();

    emitByPolicy(
      recipeEmitter,
      policy.view,
      { userId: ctx.user.id, householdKey: ctx.householdKey },
      "allergyDetectionStarted",
      { recipeId }
    );

    return { success: true };
  });

export const recipesProcedures = router({
  list: listProcedure,
  get: getProcedure,
  create,
  update,
  delete: deleteProcedure,
  importFromUrl: importFromUrlProcedure,
  importFromImages: importFromImagesProcedure,
  importFromPaste: importFromPasteProcedure,
  convertMeasurements,
  estimateNutrition,
  triggerAutoTag,
  triggerAutoCategorize,
  triggerAllergyDetection,
  reserveId,
  autocomplete,
  updateCategories,
  getRandomRecipe,
});
