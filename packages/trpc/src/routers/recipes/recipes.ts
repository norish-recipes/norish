import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { RecipeListContext } from "@norish/db";
import { canAccessResource, isAIEnabled as checkAIEnabled } from "@norish/auth/permissions";
import {
  addConvertedRecipeDataAndSetActiveSystem,
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
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { deleteRecipeImagesDir } from "@norish/shared-server/media/storage";
import { selectWeightedRandomRecipe } from "@norish/shared-server/recipes/randomizer";
import {
  appliedAck,
  FilterMode,
  mutationAckSchema,
  RecipeCategory,
  SortOrder,
  staleAck,
} from "@norish/shared/contracts";
import { FullRecipeSchema, RecipeListResultSchema } from "@norish/shared/contracts/zod";
import { isUuid } from "@norish/shared/lib/operation-helpers";

import type { UploadedFile } from "../../form-data";
import { formDataInputSchema, isUploadedFile } from "../../form-data";
import { emitByPolicy } from "../../helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { recipeEmitter } from "./emitter";
import { assertRecipeAccess, findRecipeForViewer } from "./helpers";
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

export const getEditableProcedure = authedProcedure
  .input(RecipeGetInputSchema)
  .output(FullRecipeSchema)
  .query(async ({ ctx, input }) => {
    log.debug({ userId: ctx.user.id, recipeId: input.id }, "Getting editable recipe");

    const recipe = await getRecipeFull(input.id);

    if (!recipe) {
      log.warn({ userId: ctx.user.id, recipeId: input.id }, "Editable recipe not found");

      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    await assertRecipeAccess(ctx, input.id, "edit");

    return recipe;
  });

export const createRecipeProcedure = authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/recipes",
      protect: true,
      tags: ["Recipes"],
      summary: "Create a recipe",
      description:
        "Creates a recipe directly from structured recipe data without parser transformation.",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .input(FullRecipeInsertSchema)
  .output(z.uuid())
  .mutation(async ({ ctx, input }) => {
    const recipeId = input.id ?? (isUuid(ctx.operationId) ? ctx.operationId : randomUUID());

    log.info(
      { userId: ctx.user.id, recipeName: input.name, recipeId, providedId: input.id },
      "Creating recipe"
    );
    log.debug({ recipe: input }, "Full recipe data");

    if (input.id && input.id !== recipeId) {
      log.error({ inputId: input.id, generatedId: recipeId }, "Recipe ID mismatch detected!");
    }

    try {
      const createdId = await createRecipeWithRefs(recipeId, ctx.user.id, input);

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

        await emitByPolicy(
          recipeEmitter,
          policy.view,
          { userId: ctx.user.id, householdKey: ctx.householdKey },
          "created",
          { recipe: dashboardDto }
        );
      }

      return createdId;
    } catch (err) {
      log.error({ err, userId: ctx.user.id, recipeId }, "Failed to create recipe");
      throw err;
    }
  });

const update = authedProcedure
  .input(RecipeUpdateInputSchema)
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { id, data, version } = input;

    log.info({ userId: ctx.user.id, recipeId: id }, "Updating recipe");
    log.debug({ recipe: input }, "Full recipe data");

    try {
      await assertRecipeAccess(ctx, id, "edit");
      const result = await updateRecipeWithRefs(id, ctx.user.id, data, version);

      if (result.stale) {
        log.info({ userId: ctx.user.id, recipeId: id, version }, "Ignoring stale recipe update");

        return staleAck();
      }

      const updatedRecipe = await getRecipeFull(id);

      if (updatedRecipe) {
        log.info({ userId: ctx.user.id, recipeId: id }, "Recipe updated");
        const policy = await getRecipePermissionPolicy();

        await emitByPolicy(
          recipeEmitter,
          policy.view,
          { userId: ctx.user.id, householdKey: ctx.householdKey },
          "updated",
          { recipe: updatedRecipe }
        );
      }

      return appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id, recipeId: id }, "Failed to update recipe");
      throw err;
    }
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
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { id, version } = input;

    log.info({ userId: ctx.user.id, recipeId: id }, "Deleting recipe");

    try {
      await assertRecipeAccess(ctx, id, "delete");
      await deleteRecipeImagesDir(id);
      const result = await deleteRecipeById(id, version);

      if (result.stale) {
        log.info({ userId: ctx.user.id, recipeId: id, version }, "Ignoring stale recipe delete");

        return staleAck();
      }

      log.info({ userId: ctx.user.id, recipeId: id }, "Recipe deleted");
      const policy = await getRecipePermissionPolicy();

      await emitByPolicy(
        recipeEmitter,
        policy.view,
        { userId: ctx.user.id, householdKey: ctx.householdKey },
        "deleted",
        { id }
      );

      return appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id, recipeId: id }, "Failed to delete recipe");
      throw err;
    }
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
    const recipeId = input.id ?? (isUuid(ctx.operationId) ? ctx.operationId : randomUUID());

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
  const recipeId = randomUUID();

  log.debug({ recipeId }, "Reserved recipe ID for step image uploads");

  return { recipeId };
});

const convertMeasurements = authedProcedure
  .input(RecipeConvertInputSchema)
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { recipeId, targetSystem, version } = input;

    log.info({ userId: ctx.user.id, recipeId, targetSystem }, "Converting recipe measurements");

    try {
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
          message: "Recipe has no ingredients to convert",
        });
      }

      const canEdit = recipe.userId
        ? await canAccessResource(
            "edit",
            ctx.user.id,
            recipe.userId,
            ctx.householdUserIds,
            ctx.isServerAdmin
          )
        : true;

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to edit this recipe",
        });
      }

      if (recipe.recipeIngredients.some((ri) => ri.systemUsed === targetSystem)) {
        const result = await setActiveSystemForRecipe(recipe.id, targetSystem, version);

        if (result.stale) {
          log.info({ userId: ctx.user.id, recipeId, version }, "Ignoring stale recipe conversion");

          return staleAck();
        }

        const policy = await getRecipePermissionPolicy();

        await emitByPolicy(
          recipeEmitter,
          policy.view,
          { userId: ctx.user.id, householdKey: ctx.householdKey },
          "converted",
          { recipe: { ...recipe, systemUsed: targetSystem } }
        );

        return appliedAck();
      }

      const { convertRecipeDataWithAI } = await import("@norish/shared-server/ai/unit-converter");
      const conversion = await convertRecipeDataWithAI(recipe, targetSystem);

      if (!conversion.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: conversion.error ?? "Conversion failed, please try again.",
        });
      }

      const steps = conversion.data.steps.map((s) => ({
        ...s,
        recipeId: recipe.id,
        systemUsed: targetSystem,
      }));

      const ingredients = conversion.data.ingredients.map((i) => ({
        ...i,
        recipeId: recipe.id,
        systemUsed: targetSystem,
      }));

      const activeSystemResult = await addConvertedRecipeDataAndSetActiveSystem(
        recipe.id,
        targetSystem,
        version,
        steps,
        ingredients
      );

      if (activeSystemResult.stale) {
        log.info({ userId: ctx.user.id, recipeId, version }, "Ignoring stale recipe conversion");

        return staleAck();
      }

      const updatedRecipe = await getRecipeFull(recipe.id);

      if (updatedRecipe) {
        log.info({ userId: ctx.user.id, recipeId }, "Recipe measurements converted");
        const policy = await getRecipePermissionPolicy();

        await emitByPolicy(
          recipeEmitter,
          policy.view,
          { userId: ctx.user.id, householdKey: ctx.householdKey },
          "converted",
          { recipe: { ...updatedRecipe, systemUsed: targetSystem } }
        );
      }

      return appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id, recipeId }, "Failed to convert recipe measurements");
      throw err;
    }
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
  .input(formDataInputSchema)
  .mutation(async ({ ctx, input }) => {
    const uploads: UploadedFile[] = [];

    input.forEach((value, key) => {
      if (!key.startsWith("file") || !isUploadedFile(value)) {
        return;
      }

      uploads.push(value);
    });

    const files = await Promise.all(
      uploads.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        return {
          data: buffer.toString("base64"),
          mimeType: file.type,
          filename: file.name,
        };
      })
    );

    if (files.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No files provided",
      });
    }

    const recipeId = isUuid(ctx.operationId) ? ctx.operationId : randomUUID();

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
    const preparedImport = await preparePasteImport(
      input.text,
      input.forceAI,
      ctx.operationId ?? undefined
    );

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
  getEditable: getEditableProcedure,
  create: createRecipeProcedure,
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
