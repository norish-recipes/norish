/** Routers whose every procedure stays out of the Outbox: admin settings carry API keys. */
const UNCAPTURED_ROUTERS: ReadonlySet<string> = new Set(["admin"]);

/** Procedures whose input is a credential (a CalDAV password, a site token value, a join code),
 * and a send to Bring!, whose link would be dead by the time a queued send replayed. */
const UNCAPTURED_PROCEDURES: ReadonlySet<string> = new Set([
  "caldav.saveConfig",
  "caldav.testConnection",
  "caldav.fetchCalendars",
  "siteAuthTokens.create",
  "siteAuthTokens.update",
  "households.join",
  "bring.send",
]);

/** Whether a mutation is never stored for Replay: it fails with its own error, like a query. */
export const isUncaptured = (path: string): boolean =>
  (path.includes(".") && UNCAPTURED_ROUTERS.has(path.split(".")[0] ?? "")) ||
  UNCAPTURED_PROCEDURES.has(path);
