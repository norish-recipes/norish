import "server-only";

import type { CaldavShape, HouseholdShape } from "@/components/settings/settings-tab";
import { cache } from "react";
import { readRequestProfile } from "@/lib/request-profile";

import { getCaldavConfigByUserId } from "@norish/db/repositories/caldav-config";
import { getHouseholdForUser } from "@norish/db/repositories/households";

// Which cards a tab draws for this reader, so its skeleton and its page draw the same ones.
// The layout has already sent a signed-out reader to sign in.

export const readHouseholdShape = cache(async (): Promise<HouseholdShape> => {
  const { identity } = await readRequestProfile();
  const household = identity ? await getHouseholdForUser(identity.id) : null;

  if (!household) return "none";

  return household.adminUserId === identity?.id ? "admin" : "member";
});

export const readCaldavShape = cache(async (): Promise<CaldavShape> => {
  const { identity } = await readRequestProfile();
  const caldav = identity ? await getCaldavConfigByUserId(identity.id) : null;

  if (!caldav) return "none";

  return caldav.enabled ? "enabled" : "disabled";
});
