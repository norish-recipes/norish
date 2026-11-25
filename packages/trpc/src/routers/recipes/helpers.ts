import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { PermissionAction } from "@norish/auth/permissions";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import { canAccessResource } from "@norish/auth/permissions";
import { getRecipeFull, getRecipeHouseholdIds } from "@norish/db";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { recipes } from "@norish/shared-server/realtime/recipes";

export type RecipeUserContext = {
  user: { id: string };
  householdId: string;
};

// ponytail: this process's creates only; a second server process would need a shared lock.
const creating = new Map<string, Promise<unknown>>();

/** Runs a recipe's create, so media uploaded for its id meanwhile waits for it. */
export function whileCreating<T>(recipeId: string, create: () => Promise<T>): Promise<T> {
  const running: Promise<T> = create().finally(() => {
    if (creating.get(recipeId) === running) creating.delete(recipeId);
  });

  creating.set(recipeId, running);

  return running;
}

/** Waits for a create of this id still running here; a failed create is reported by the create. */
export async function createSettled(recipeId: string): Promise<void> {
  await creating.get(recipeId)?.catch(() => undefined);
}

export async function emitRecipeFailure(
  ctx: Pick<RecipeUserContext, "user" | "householdId">,
  reason: string,
  meta?: { recipeId?: string; url?: string }
): Promise<void> {
  const policy = await getRecipePermissionPolicy();

  void recipes.publish(
    "failed",
    { reason, ...meta },
    { viewPolicy: policy.view, userId: ctx.user.id, householdId: ctx.householdId }
  );
}

export function handleRecipeError(
  ctx: Pick<RecipeUserContext, "user" | "householdId">,
  err: unknown,
  operation: string,
  meta?: { recipeId?: string; url?: string }
): void {
  const error = err as Error;

  log.error({ err: error, userId: ctx.user.id, ...meta }, `Failed to ${operation}`);
  void emitRecipeFailure(ctx, error.message || `Failed to ${operation}`, meta);
}

/** Announce a recipe as stored now to everyone who may view it, and return it. */
export async function announceRecipeUpdated(
  ctx: Pick<RecipeUserContext, "user" | "householdId">,
  recipeId: string
): Promise<FullRecipeDTO | null> {
  const stored = await getRecipeFull(recipeId);

  if (stored) {
    const policy = await getRecipePermissionPolicy();

    void recipes.publish(
      "updated",
      { recipe: stored },
      { viewPolicy: policy.view, userId: ctx.user.id, householdId: ctx.householdId }
    );
  }

  return stored;
}

/**
 * Whether the reader may do `action` to each recipe, under the Permission Policy. A recipe they
 * may not view is left out, exactly as one that does not exist.
 */
export async function recipeAccess(
  ctx: Pick<RecipeUserContext, "householdId">,
  recipeIds: string[],
  action: PermissionAction
): Promise<Map<string, boolean>> {
  const households = await getRecipeHouseholdIds(recipeIds);
  const access = new Map<string, boolean>();

  for (const [recipeId, householdId] of households) {
    if (!(await canAccessResource("view", ctx.householdId, householdId))) continue;
    access.set(
      recipeId,
      action === "view" || (await canAccessResource(action, ctx.householdId, householdId))
    );
  }

  return access;
}

/** Refuses unless the reader may do `action`; a recipe they may not view is not found. */
export async function assertRecipeAccess(
  ctx: Pick<RecipeUserContext, "householdId">,
  recipeId: string,
  action: PermissionAction
): Promise<void> {
  const allowed = (await recipeAccess(ctx, [recipeId], action)).get(recipeId);

  if (allowed === undefined) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
  }
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this recipe",
    });
  }
}

/**
 * A recipe id a media path is built from: a UUID or nothing, since it becomes
 * a directory name under the uploads folder.
 */
export function mediaRecipeId(value: unknown): string | null {
  const parsed = z.uuid().safeParse(value);

  return parsed.success ? parsed.data : null;
}

/** The recipe a stored media URL (`/recipes/{id}/…`) belongs to. */
export function recipeIdOfMediaUrl(url: string): string | null {
  return mediaRecipeId(/^\/recipes\/([^/]+)\//.exec(url)?.[1]);
}

/**
 * Refuses media work on a recipe the reader may not edit. A recipe not stored yet (the new-recipe
 * form uploads first) is the caller's own, so its files pass.
 */
export async function assertRecipeMediaAccess(
  ctx: Pick<RecipeUserContext, "householdId">,
  recipeId: string
): Promise<void> {
  if ((await getRecipeHouseholdIds([recipeId])).has(recipeId)) {
    await assertRecipeAccess(ctx, recipeId, "edit");
  }
}

/** The recipe, or null when there is none or the reader may not view it. */
export async function findRecipeForViewer(
  ctx: Pick<RecipeUserContext, "householdId">,
  recipeId: string
): Promise<FullRecipeDTO | null> {
  const viewable = (await recipeAccess(ctx, [recipeId], "view")).has(recipeId);

  return viewable ? getRecipeFull(recipeId) : null;
}
