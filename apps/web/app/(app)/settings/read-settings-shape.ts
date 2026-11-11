import "server-only";

import { cache } from "react";
import { readRequestProfile } from "@/lib/request-profile";

import { getCaldavConfigByUserId } from "@norish/db/repositories/caldav-config";

import type { CaldavShape } from "./caldav/components/caldav-shape";

/** Whether the reader has a CalDAV config and whether it is enabled. */
export const readCaldavShape = cache(async (): Promise<CaldavShape> => {
  const { identity } = await readRequestProfile();
  const caldav = identity ? await getCaldavConfigByUserId(identity.id) : null;

  if (!caldav) return "none";

  return caldav.enabled ? "enabled" : "disabled";
});
