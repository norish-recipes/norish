import { TRPCError } from "@trpc/server";

import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";
import { emitByPolicy } from "../../helpers";

import { recipeEmitter } from "./emitter";
import { importRecipeFromUrl } from "./import";

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
import { FilterMode, SortOrder } from "@/types";

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
      message: "You do not have permission to perform this action",
    });
  }
}

// Procedures
const list = authedProcedure.input(RecipeListInputSchema).query(async ({ ctx, input }) => {
  const { cursor, limit, search, tags, filterMode, sortMode } = input;

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
    sortMode as SortOrder
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

const create = authedProcedure.input(FullRecipeInsertSchema).mutation(async ({ ctx, input }) => {
  const recipeId = crypto.randomUUID();

  log.info({ userId: ctx.user.id, recipeName: input.name }, "Creating recipe");

  try {
    const createdId = await createRecipeWithRefs(recipeId, ctx.user.id, input);

    if (!createdId) {
      throw new Error("Failed to create recipe");
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

    return recipeId;
  } catch (err) {
    handleError(ctx, err, "create recipe", { recipeId });
    throw err;
  }
});

const update = authedProcedure.input(RecipeUpdateInputSchema).mutation(async ({ ctx, input }) => {
  const { id, data } = input;

  log.info({ userId: ctx.user.id, recipeId: id }, "Updating recipe");

  try {
    await assertRecipeAccess(ctx, id, "edit");
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

    return { success: true };
  } catch (err) {
    handleError(ctx, err, "update recipe", { recipeId: id });
    throw err;
  }
});

const deleteProcedure = authedProcedure
  .input(RecipeDeleteInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { id } = input;

    log.info({ userId: ctx.user.id, recipeId: id }, "Deleting recipe");

    try {
      await assertRecipeAccess(ctx, id, "delete");
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

      return { success: true };
    } catch (err) {
      handleError(ctx, err, "delete recipe", { recipeId: id });
      throw err;
    }
  });

const importFromUrlProcedure = authedProcedure
  .input(RecipeImportInputSchema)
  .mutation(({ ctx, input }) => {
    const { url } = input;
    const recipeId = crypto.randomUUID();

    importRecipeFromUrl({ userId: ctx.user.id, householdKey: ctx.householdKey }, recipeId, url);

    return recipeId;
  });

const convertMeasurements = authedProcedure
  .input(RecipeConvertInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { recipeId, targetSystem } = input;

    log.info({ userId: ctx.user.id, recipeId, targetSystem }, "Converting recipe measurements");

    try {
      const aiEnabled = await checkAIEnabled();

      if (!aiEnabled) {
        throw new Error("AI features are disabled");
      }

      const recipe = await getRecipeFull(recipeId);

      if (!recipe) {
        throw new Error("Recipe not found");
      }

      if (recipe.recipeIngredients.length === 0) {
        throw new Error("Recipe has no ingredients to convert");
      }

      // Check edit permission
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

      // Check if already converted (has ingredients with target system)
      if (recipe.recipeIngredients.some((ri) => ri.systemUsed === targetSystem)) {
        await setActiveSystemForRecipe(recipe.id, targetSystem);
        const policy = await getRecipePermissionPolicy();

        emitByPolicy(
          recipeEmitter,
          policy.view,
          { userId: ctx.user.id, householdKey: ctx.householdKey },
          "converted",
          { recipe: { ...recipe, systemUsed: targetSystem } }
        );

        return { success: true };
      }

      // Convert with AI
      const { convertRecipeDataWithAI } = await import("@/server/ai/unit-converter");
      const converted = await convertRecipeDataWithAI(recipe, targetSystem);

      if (!converted) {
        throw new Error("Conversion failed, please try again.");
      }

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

      await addStepsAndIngredientsToRecipeByInput(steps, ingredients);
      await setActiveSystemForRecipe(recipe.id, targetSystem);
      const updatedRecipe = await getRecipeFull(recipe.id);

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

      return { success: true };
    } catch (err) {
      handleError(ctx, err, "convert recipe measurements", { recipeId });
      throw err;
    }
  });

export const recipesProcedures = router({
  list,
  get,
  create,
  update,
  delete: deleteProcedure,
  importFromUrl: importFromUrlProcedure,
  convertMeasurements,
});
