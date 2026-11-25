import { ONE_TIME_SECRET_PATHS } from "@norish/shared/lib/one-time-secrets";

/** Routers whose every procedure stays out of the Outbox: admin settings carry API keys. */
const UNCAPTURED_ROUTERS: ReadonlySet<string> = new Set(["admin"]);

/** Procedures whose input is a credential (a CalDAV password, a site token value, a join code)
 * or whose response is a one-time secret. */
const UNCAPTURED_PROCEDURES: ReadonlySet<string> = new Set([
  "caldav.saveConfig",
  "caldav.testConnection",
  "caldav.fetchCalendars",
  "siteAuthTokens.create",
  "siteAuthTokens.update",
  "households.join",
  // Moderation of other accounts' links acts on the server's state now, not on replay.
  "recipes.shareRevokeAdmin",
  "recipes.shareReactivateAdmin",
  "recipes.shareDeleteAdmin",
  // Creating a list entry needs the server: it fails at once rather than waiting in the Outbox.
  "lists.add",
  ...ONE_TIME_SECRET_PATHS,
]);

/** Whether a mutation is never stored for Replay: it fails with its own error, like a query. */
export const isUncaptured = (path: string): boolean =>
  (path.includes(".") && UNCAPTURED_ROUTERS.has(path.split(".")[0] ?? "")) ||
  UNCAPTURED_PROCEDURES.has(path);
