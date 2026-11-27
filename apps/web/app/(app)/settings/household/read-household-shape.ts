import "server-only";

import { cache } from "react";
import { readRequestProfile } from "@/lib/request-profile";
import { serverPackage } from "@/lib/server-package";

const { getHouseholdForUser } = await serverPackage<
  typeof import("@norish/db/repositories/households")
>("@norish/db/repositories/households");

/**
 * Whether the reader's household is just them, and whether they administer it. `cache` shares
 * the read between the tab's skeleton and its page.
 */
export const readHouseholdShape = cache(async () => {
  const { identity } = await readRequestProfile();
  const household = identity ? await getHouseholdForUser(identity.id) : null;

  if (!household || household.users.length === 1) return "solo" as const;

  return household.adminUserId === identity?.id ? ("admin" as const) : ("member" as const);
});
