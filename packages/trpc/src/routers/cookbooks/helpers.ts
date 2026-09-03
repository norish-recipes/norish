import { TRPCError } from "@trpc/server";

import type { PermissionAction } from "@norish/auth/permissions";
import type { RecipeListContext } from "@norish/db";
import { canAccessResource } from "@norish/auth/permissions";
import { getCookbookRow } from "@norish/db/repositories/cookbooks";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";

import type { CookbookSubscriptionEvents } from "./emitter";
import { emitByPolicy } from "../../helpers";
import { cookbookEmitter } from "./emitter";

export type CookbookUserContext = {
  user: { id: string };
  householdUserIds: string[] | null;
  householdKey: string;
  isServerAdmin: boolean;
};

export function listContextFor(ctx: CookbookUserContext): RecipeListContext {
  return {
    userId: ctx.user.id,
    householdUserIds: ctx.householdUserIds,
    isServerAdmin: ctx.isServerAdmin,
  };
}

/**
 * Cookbooks answer to the recipe permission policy, not a rule of their own
 * (ADR-0027), and an Orphaned cookbook is fair game for everyone under every
 * policy — the same answer `assertRecipeAccess` gives for an orphaned recipe.
 *
 * Returns the row so a caller that needs the version or title does not read
 * it twice.
 */
export async function assertCookbookAccess(
  ctx: Pick<CookbookUserContext, "user" | "householdUserIds" | "isServerAdmin">,
  cookbookId: string,
  action: PermissionAction
) {
  const cookbook = await getCookbookRow(cookbookId);

  if (!cookbook) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Cookbook not found" });
  }

  if (cookbook.userId === null) {
    log.debug({ cookbookId }, `${action} orphaned cookbook`);

    return cookbook;
  }

  const canAccess = await canAccessResource(
    action,
    ctx.user.id,
    cookbook.userId,
    ctx.householdUserIds,
    ctx.isServerAdmin
  );

  if (!canAccess) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this cookbook",
    });
  }

  return cookbook;
}

/**
 * Broadcast a cookbook event to whoever the view policy says may see it —
 * the same reach the cookbook itself has.
 */
export async function emitCookbookEvent<K extends keyof CookbookSubscriptionEvents & string>(
  ctx: Pick<CookbookUserContext, "user" | "householdKey">,
  event: K,
  data: CookbookSubscriptionEvents[K]
): Promise<void> {
  const policy = await getRecipePermissionPolicy();

  emitByPolicy(
    cookbookEmitter,
    policy.view,
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    event,
    data
  );
}
