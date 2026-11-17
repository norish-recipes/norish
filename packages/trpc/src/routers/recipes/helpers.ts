import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { PermissionAction } from "@norish/auth/permissions";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import { canAccessResource } from "@norish/auth/permissions";
import { getRecipeFull, getRecipeOwnerId, getRecipeOwnerIds } from "@norish/db";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { recipes } from "@norish/shared-server/realtime/recipes";

export type RecipeUserContext = {
  user: { id: string };
  householdUserIds: string[] | null;
  householdKey: string;
  isServerAdmin: boolean;
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
  ctx: Pick<RecipeUserContext, "user" | "householdKey">,
  reason: string,
  meta?: { recipeId?: string; url?: string }
): Promise<void> {
  const policy = await getRecipePermissionPolicy();

  void recipes.publish(
    "failed",
    { reason, ...meta },
    { viewPolicy: policy.view, userId: ctx.user.id, householdKey: ctx.householdKey }
  );
}

export function handleRecipeError(
  ctx: Pick<RecipeUserContext, "user" | "householdKey">,
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
  ctx: Pick<RecipeUserContext, "user" | "householdKey">,
  recipeId: string
): Promise<FullRecipeDTO | null> {
  const stored = await getRecipeFull(recipeId);

  if (stored) {
    const policy = await getRecipePermissionPolicy();

    void recipes.publish(
      "updated",
      { recipe: stored },
      { viewPolicy: policy.view, userId: ctx.user.id, householdKey: ctx.householdKey }
    );
  }

  return stored;
}

export async function assertRecipeAccess(
  ctx: Pick<RecipeUserContext, "user" | "householdUserIds" | "isServerAdmin">,
  recipeId: string,
  action: PermissionAction
): Promise<void> {
  const ownerId = await getRecipeOwnerId(recipeId);

  if (ownerId === null) {
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

/**
 * Whether the reader may do `action` to each of these recipes. Orphaned ones
 * are open to everyone; ones that do not exist are left out of the map.
 */
export async function recipeAccess(
  ctx: Pick<RecipeUserContext, "user" | "householdUserIds" | "isServerAdmin">,
  recipeIds: string[],
  action: PermissionAction
): Promise<Map<string, boolean>> {
  const owners = await getRecipeOwnerIds(recipeIds);
  const byOwner = new Map<string, Promise<boolean>>();
  const access = new Map<string, boolean>();

  for (const [recipeId, ownerId] of owners) {
    if (ownerId === null) {
      access.set(recipeId, true);
      continue;
    }

    let allowed = byOwner.get(ownerId);

    if (!allowed) {
      allowed = canAccessResource(
        action,
        ctx.user.id,
        ownerId,
        ctx.householdUserIds,
        ctx.isServerAdmin
      );
      byOwner.set(ownerId, allowed);
    }

    access.set(recipeId, await allowed);
  }

  return access;
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

export async function findRecipeForViewer(
  ctx: Pick<RecipeUserContext, "user" | "householdUserIds" | "isServerAdmin">,
  recipeId: string
): Promise<FullRecipeDTO | null> {
  const recipe = await getRecipeFull(recipeId);

  if (!recipe) {
    return null;
  }

  if (recipe.userId) {
    const canView = await canAccessResource(
      "view",
      ctx.user.id,
      recipe.userId,
      ctx.householdUserIds,
      ctx.isServerAdmin
    );

    if (!canView) {
      return null;
    }
  }

  return recipe;
}
