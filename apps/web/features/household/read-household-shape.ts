import "server-only";

import { cache } from "react";
import { readRequestProfile } from "@/lib/request-profile";

import { getHouseholdForUser } from "@norish/db/repositories/households";

import type { HouseholdShape } from "./household-shape";

/**
 * Whether the reader has a household and administers it. `cache` shares the read between the
 * tab's skeleton and its page.
 */
export const readHouseholdShape = cache(async (): Promise<HouseholdShape> => {
  const { identity } = await readRequestProfile();
  const household = identity ? await getHouseholdForUser(identity.id) : null;

  if (!household) return "none";

  return household.adminUserId === identity?.id ? "admin" : "member";
});
