import "server-only";

import { cache } from "react";
import { readRequestProfile } from "@/lib/request-profile";

import { getCaldavConfigByUserId } from "@norish/db/repositories/caldav-config";
import { getHouseholdForUser } from "@norish/db/repositories/households";

import type { CaldavShape } from "./caldav/components/caldav-shape";
import type { HouseholdShape } from "./household/components/household-shape";

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

/** Whether the reader has a CalDAV config and whether it is enabled. */
export const readCaldavShape = cache(async (): Promise<CaldavShape> => {
  const { identity } = await readRequestProfile();
  const caldav = identity ? await getCaldavConfigByUserId(identity.id) : null;

  if (!caldav) return "none";

  return caldav.enabled ? "enabled" : "disabled";
});
