import { isUpdateAvailable } from "@norish/shared/lib/version";

import { version as appVersion } from "../../../../package.json";

/** The current release's minor, so it moves with each release: 0.27.0-beta needs 0.27.0. */
export const MINIMUM_SERVER_VERSION = appVersion.replace(/^(\d+\.\d+)\..*$/, "$1.0");

/** A readiness response without `version` comes from a server older than the field. */
export function isServerTooOld(health: unknown): boolean {
  const version =
    typeof health === "object" && health !== null && "version" in health ? health.version : null;

  return typeof version !== "string" || isUpdateAvailable(version, MINIMUM_SERVER_VERSION);
}
