import "server-only";

import { cache } from "react";
import { readRequestProfile } from "@/lib/request-profile";
import { serverPackage } from "@/lib/server-package";

const { getCaldavConfigByUserId } = await serverPackage<
  typeof import("@norish/db/repositories/caldav-config")
>("@norish/db/repositories/caldav-config");

/**
 * Whether the reader has a CalDAV config and whether it is enabled. `cache` shares the read
 * between the tab's skeleton and its page.
 */
export const readCaldavShape = cache(async () => {
  const { identity } = await readRequestProfile();
  const caldav = identity ? await getCaldavConfigByUserId(identity.id) : null;

  if (!caldav) return "none";

  return caldav.enabled ? "enabled" : "disabled";
});
