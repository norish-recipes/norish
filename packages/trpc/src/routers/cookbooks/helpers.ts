import { TRPCError } from "@trpc/server";

import type { PermissionAction } from "@norish/auth/permissions";
import type { PermissionLevel } from "@norish/config/zod/server-config";
import type { ClientEventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { CookbooksRealtime } from "@norish/shared/contracts/realtime/cookbooks";
import { canAccessResource } from "@norish/auth/permissions";
import { getCookbookRow } from "@norish/db/repositories/cookbooks";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { cookbooks } from "@norish/shared-server/realtime/cookbooks";

export type CookbookUserContext = {
  user: { id: string };
  householdId: string;
};

/**
 * Cookbooks answer to the recipe Permission Policy, not a rule of their own (ADR-0027). One the
 * reader may not view is not found; one they may view but not `action` is forbidden.
 * Returns the row so a caller that needs the version or title does not read it twice.
 */
export async function assertCookbookAccess(
  ctx: Pick<CookbookUserContext, "householdId">,
  cookbookId: string,
  action: PermissionAction
) {
  const cookbook = await getCookbookRow(cookbookId);

  if (!cookbook || !(await canAccessResource("view", ctx.householdId, cookbook.householdId))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Cookbook not found" });
  }
  if (!(await canAccessResource(action, ctx.householdId, cookbook.householdId))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to access this cookbook",
    });
  }

  return cookbook;
}

/**
 * Broadcast a cookbook event to whoever the view policy says may see it: the
 * cookbook's own household, or everyone. The same reach the cookbook has.
 */
export async function emitCookbookEvent<E extends ClientEventName<CookbooksRealtime>>(
  householdId: string,
  event: E,
  data: PayloadOf<CookbooksRealtime, E>
): Promise<void> {
  const policy = await getRecipePermissionPolicy();
  // Every cookbook event is policy-scoped; the generic `TargetFor` cannot see
  // that for an open `E`, so the target shape is pinned here once.
  const publish = cookbooks.publish as (
    event: E,
    payload: PayloadOf<CookbooksRealtime, E>,
    target: { viewPolicy: PermissionLevel; householdId: string }
  ) => Promise<void>;

  await publish(event, data, { viewPolicy: policy.view, householdId });
}
