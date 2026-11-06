import { isUpdateAvailable } from "@norish/shared/lib/version";

import { version as appVersion } from "../../../../package.json";

/** The current release's minor, so it moves with each release: 0.27.0-beta needs 0.27.0. */
export const MINIMUM_SERVER_VERSION = appVersion.replace(/^(\d+\.\d+)\..*$/, "$1.0");

export type ServerHealthVerdict = "ok" | "too-old" | "not-norish";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Every Norish health response since 0.18 is `status: "ok"` with a `parser` report. */
export function classifyServerHealth(health: unknown): ServerHealthVerdict {
  if (!isRecord(health) || health.status !== "ok" || !isRecord(health.parser)) {
    return "not-norish";
  }

  const { version } = health;

  return typeof version === "string" && !isUpdateAvailable(version, MINIMUM_SERVER_VERSION)
    ? "ok"
    : "too-old";
}
