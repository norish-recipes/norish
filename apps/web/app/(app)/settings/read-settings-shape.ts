import "server-only";

import { cache } from "react";
import { readRequestProfile } from "@/lib/request-profile";

import { getCaldavConfigByUserId } from "@norish/db/repositories/caldav-config";
import { getHouseholdForUser } from "@norish/db/repositories/households";

import type { SettingsShape } from "./settings-tab";

/**
 * Which tabs and cards the reader's settings show, so the route's skeleton and the page draw the
 * same ones. Hiding the admin tab is presentation only: admin procedures authorise server-side.
 */
export const readSettingsShape = cache(async (): Promise<SettingsShape> => {
  const { identity } = await readRequestProfile();

  // The layout has already sent a signed-out reader to sign in.
  if (!identity) return { showAdminTab: false, household: "none", caldav: "none" };

  const [household, caldav] = await Promise.all([
    getHouseholdForUser(identity.id),
    getCaldavConfigByUserId(identity.id),
  ]);

  return {
    showAdminTab: identity.isServerAdmin,
    household: !household ? "none" : household.adminUserId === identity.id ? "admin" : "member",
    caldav: !caldav ? "none" : caldav.enabled ? "enabled" : "disabled",
  };
});
