/** Routers whose every procedure stays out of the Outbox: admin settings carry API keys, and a
 * Bring Handoff is prepared for a sheet that is open now, which a replay would long have outlived. */
const UNCAPTURED_ROUTERS: ReadonlySet<string> = new Set(["admin", "bring"]);

/** Procedures whose input is a credential: a CalDAV password, a site token value, a join code. */
const UNCAPTURED_PROCEDURES: ReadonlySet<string> = new Set([
  "caldav.saveConfig",
  "caldav.testConnection",
  "caldav.fetchCalendars",
  "siteAuthTokens.create",
  "siteAuthTokens.update",
  "households.join",
]);

/** Whether a mutation is never stored for Replay: it fails with its own error, like a query. */
export const isUncaptured = (path: string): boolean =>
  (path.includes(".") && UNCAPTURED_ROUTERS.has(path.split(".")[0] ?? "")) ||
  UNCAPTURED_PROCEDURES.has(path);
