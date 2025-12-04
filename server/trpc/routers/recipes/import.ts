import type { PermissionLevel } from "@/server/db/zodSchemas/server-config";

import { TRPCError } from "@trpc/server";

import { emitByPolicy, type PolicyEmitContext } from "../../helpers";

import { recipeEmitter } from "./emitter";

import { trpcLogger as log } from "@/server/logger";
import { createRecipeWithRefs, dashboardRecipe, getRecipeByUrl } from "@/server/db";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";

// Active import locks to prevent duplicate imports
// NOTE: This only works for single-process deployments. For multi-process/clustered
// deployments, consider using Redis or a database table for distributed locking.
const activeImports = new Set<string>();

export type ImportContext = PolicyEmitContext;

/**
 * Process a recipe import from URL asynchronously.
 * Emits events for import progress and completion.
 */
async function processImport(
  ctx: ImportContext,
  recipeId: string,
  url: string,
  viewPolicy: PermissionLevel
): Promise<void> {
  // Check if recipe already exists
  const existingRecipe = await getRecipeByUrl(url);

  if (existingRecipe) {
    const dashboardDto = await dashboardRecipe(existingRecipe.id);

    if (dashboardDto) {
      log.info({ userId: ctx.userId, recipeId: existingRecipe.id }, "Recipe already exists");
      // Include pendingRecipeId so client can remove the skeleton
      emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
        recipe: dashboardDto,
        pendingRecipeId: recipeId,
      });
    }

    return;
  }

  // Parse and create recipe
  const { parseRecipeFromUrl } = await import("@/lib/parser");
  const parsedRecipe = await parseRecipeFromUrl(url);

  if (!parsedRecipe) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Failed to parse recipe from URL",
    });
  }

  const createdId = await createRecipeWithRefs(recipeId, ctx.userId, parsedRecipe);

  if (!createdId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to save imported recipe",
    });
  }

  const dashboardDto = await dashboardRecipe(createdId);

  if (dashboardDto) {
    log.info({ userId: ctx.userId, recipeId: createdId, url }, "Recipe imported");
    emitByPolicy(recipeEmitter, viewPolicy, ctx, "imported", {
      recipe: dashboardDto,
      pendingRecipeId: recipeId,
    });
  }
}

/**
 * Import a recipe from a URL.
 * Fires and forgets the import process, emitting events for progress.
 *
 * @param ctx - Import context with userId and householdKey
 * @param recipeId - Pre-generated recipe ID
 * @param url - URL to import from
 */
export function importRecipeFromUrl(ctx: ImportContext, recipeId: string, url: string): void {
  getRecipePermissionPolicy()
    .then((policy) => {
      const viewPolicy = policy.view;

      log.info({ userId: ctx.userId, url, viewPolicy }, "Importing recipe from URL");

      // Check for duplicate import
      if (activeImports.has(url)) {
        log.warn({ userId: ctx.userId, url }, "Duplicate import attempt");
        emitByPolicy(recipeEmitter, viewPolicy, ctx, "failed", {
          reason: "This recipe is already being imported",
          url,
        });

        return;
      }

      activeImports.add(url);

      // Emit import started immediately
      emitByPolicy(recipeEmitter, viewPolicy, ctx, "importStarted", { recipeId, url });

      // Process import asynchronously
      processImport(ctx, recipeId, url, viewPolicy)
        .catch((err) => {
          const error = err as Error;

          log.error({ err: error, userId: ctx.userId, recipeId, url }, "Failed to import recipe");
          emitByPolicy(recipeEmitter, viewPolicy, ctx, "failed", {
            reason: error.message || "Failed to import recipe",
            recipeId,
            url,
          });
        })
        .finally(() => {
          activeImports.delete(url);
        });
    })
    .catch((err) => {
      log.error({ err, userId: ctx.userId, url }, "Failed to get recipe permission policy");
      recipeEmitter.emitToHousehold(ctx.householdKey, "failed", {
        reason: "Failed to start import",
        url,
      });
    });
}
