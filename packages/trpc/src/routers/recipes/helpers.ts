import { TRPCError } from "@trpc/server";

import type { PermissionAction } from "@norish/auth/permissions";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import { canAccessResource, resourceAccess } from "@norish/auth/permissions";
import { getRecipeFull, getRecipeHouseholdIds } from "@norish/db";
import { getHouseholdIdForUser } from "@norish/db/repositories/households";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { mayUsePendingRecipeId } from "@norish/shared-server/media/pending-recipe-media";
import { accountAudience, policyAudience } from "@norish/shared-server/realtime/audience";
import { recipes } from "@norish/shared-server/realtime/recipes";
import { mediaId } from "@norish/shared/lib/recipe-media";

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
  // Nothing stored yet: the actor's household, the one the recipe was for.
  const audience = await accountAudience(ctx.user.id);

  if (audience) void recipes.publish("failed", { reason, ...meta }, audience);
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

  if (stored)
    void recipes.publish("updated", { recipe: stored }, await policyAudience(stored.householdId));

  return stored;
}

/** Whether the reader may do `action` to each recipe; one they may not view is left out, as one
 * that does not exist. */
export async function recipeAccess(
  ctx: Pick<RecipeUserContext, "householdId">,
  recipeIds: string[],
  action: PermissionAction
): Promise<Map<string, boolean>> {
  const access = new Map<string, boolean>();

  for (const [recipeId, householdId] of await getRecipeHouseholdIds(recipeIds)) {
    const allowed = await resourceAccess(action, ctx.householdId, householdId);

    if (allowed !== undefined) access.set(recipeId, allowed);
  }

  return access;
}

/** Whether the reader may view the recipe; a gone one and a hidden one answer the same. */
export async function canViewRecipe(
  ctx: Pick<RecipeUserContext, "householdId">,
  recipeId: string
): Promise<boolean> {
  return (await recipeAccess(ctx, [recipeId], "view")).has(recipeId);
}

/** A recipe or cookbook the reader may not view, or that is gone: the two read the same. */
export function notFoundError(what: "recipe" | "cookbook") {
  return new TRPCError({
    code: "NOT_FOUND",
    message: `${what === "recipe" ? "Recipe" : "Cookbook"} not found`,
  });
}

/** Refuses what `resourceAccess` answered: not found when out of view, forbidden when not allowed. */
export function refuseUnlessAllowed(
  allowed: boolean | undefined,
  what: "recipe" | "cookbook"
): asserts allowed {
  if (allowed === undefined) throw notFoundError(what);
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You do not have permission to access this ${what}`,
    });
  }
}

/** Refuses unless the reader may do `action`; a recipe they may not view is not found. */
export async function assertRecipeAccess(
  ctx: Pick<RecipeUserContext, "householdId">,
  recipeId: string,
  action: PermissionAction
): Promise<void> {
  refuseUnlessAllowed((await recipeAccess(ctx, [recipeId], action)).get(recipeId), "recipe");
}

/** The recipe a stored media URL (`/recipes/{id}/…`) belongs to. */
export function recipeIdOfMediaUrl(url: string): string | null {
  return mediaId(/^\/recipes\/([^/]+)\//.exec(url)?.[1]);
}

/**
 * Refuses media work on a recipe the reader may not edit. A recipe not stored yet (the new-recipe
 * form uploads first) is the account's whose upload wrote its first file.
 */
export async function assertRecipeMediaAccess(
  ctx: Pick<RecipeUserContext, "user" | "householdId">,
  recipeId: string,
  use: "upload" | "delete"
): Promise<void> {
  if ((await getRecipeHouseholdIds([recipeId])).has(recipeId)) {
    await assertRecipeAccess(ctx, recipeId, "edit");
  } else if (!(await mayUsePendingRecipeId(recipeId, ctx.user.id, use))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
  }
}

/** Whether the reader may view an account's import, from the household it is in now. */
export async function canViewImportOf(
  ctx: Pick<RecipeUserContext, "householdId">,
  userId: string
): Promise<boolean> {
  const householdId = await getHouseholdIdForUser(userId);

  return householdId !== null && (await canAccessResource("view", ctx.householdId, householdId));
}

/** The recipe, or null when there is none or the reader may not view it. */
export async function findRecipeForViewer(
  ctx: Pick<RecipeUserContext, "householdId">,
  recipeId: string
): Promise<FullRecipeDTO | null> {
  return (await canViewRecipe(ctx, recipeId)) ? getRecipeFull(recipeId) : null;
}
