import type { PermissionAction } from "@norish/auth/permissions";
import type { PolicyTarget } from "@norish/shared-server/realtime/domain";
import type { ClientEventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { CookbooksRealtime } from "@norish/shared/contracts/realtime/cookbooks";
import { resourceAccess } from "@norish/auth/permissions";
import { getCookbookRow } from "@norish/db/repositories/cookbooks";
import { cookbooks } from "@norish/shared-server/realtime/cookbooks";

import { notFoundError, refuseUnlessAllowed } from "../recipes/helpers";

export type CookbookUserContext = {
  householdId: string;
};

/** Cookbooks answer to the recipe Permission Policy (ADR-0027), refused as a recipe is. Returns
 * the row so a caller that needs the version or title does not read it twice. */
export async function assertCookbookAccess(
  ctx: CookbookUserContext,
  cookbookId: string,
  action: PermissionAction
) {
  const cookbook = await getCookbookRow(cookbookId);

  if (!cookbook) throw notFoundError("cookbook");
  refuseUnlessAllowed(
    await resourceAccess(action, ctx.householdId, cookbook.householdId),
    "cookbook"
  );

  return cookbook;
}

/** Broadcast a cookbook event to its audience, read at publish (`cookbookAudience`); none, none hear. */
export async function emitCookbookEvent<E extends ClientEventName<CookbooksRealtime>>(
  audience: PolicyTarget | null,
  event: E,
  data: PayloadOf<CookbooksRealtime, E>
): Promise<void> {
  if (!audience) return;

  // Every cookbook event is policy-scoped; `TargetFor` cannot see that for an open `E`.
  const publish = cookbooks.publish as (
    event: E,
    payload: PayloadOf<CookbooksRealtime, E>,
    target: PolicyTarget
  ) => Promise<void>;

  await publish(event, data, audience);
}
