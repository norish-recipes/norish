import { TRPCError } from "@trpc/server";

import type { PermissionAction } from "@norish/auth/permissions";
import type { PolicyTarget } from "@norish/shared-server/realtime/domain";
import type { ClientEventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { CookbooksRealtime } from "@norish/shared/contracts/realtime/cookbooks";
import { canAccessResource } from "@norish/auth/permissions";
import { getCookbookRow } from "@norish/db/repositories/cookbooks";
import { policyAudience } from "@norish/shared-server/realtime/audience";
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

/** Broadcast a cookbook event to whoever the view policy now lets see the household's cookbooks. */
export async function emitCookbookEvent<E extends ClientEventName<CookbooksRealtime>>(
  householdId: string,
  event: E,
  data: PayloadOf<CookbooksRealtime, E>
): Promise<void> {
  // Every cookbook event is policy-scoped; `TargetFor` cannot see that for an open `E`.
  const publish = cookbooks.publish as (
    event: E,
    payload: PayloadOf<CookbooksRealtime, E>,
    target: PolicyTarget
  ) => Promise<void>;

  await publish(event, data, await policyAudience(householdId));
}
