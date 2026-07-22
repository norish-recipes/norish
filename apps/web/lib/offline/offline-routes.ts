/**
 * The offline bootstrap route table (ADR-0009).
 *
 * When a document navigation fails with no cached copy, the service worker
 * serves the precached `/~offline` shell for the requested URL. The client
 * bootstrap then maps that URL onto a Warm Set surface: the dashboard, a
 * warmed recipe detail, groceries, or the calendar. Everything else — edit,
 * import, settings, admin, arbitrary routes — gets the explicit
 * Offline-unavailable state rather than a broken or empty app.
 */

export type OfflineRouteMatch =
  | { kind: "dashboard" }
  | { kind: "groceries" }
  | { kind: "calendar" }
  | { kind: "recipe"; id: string }
  | { kind: "unsupported" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function matchOfflineRoute(pathname: string): OfflineRouteMatch {
  const path = pathname.replace(/\/+$/, "") || "/";

  if (path === "/") return { kind: "dashboard" };
  if (path === "/groceries") return { kind: "groceries" };
  if (path === "/calendar") return { kind: "calendar" };

  const recipe = /^\/recipes\/([^/]+)$/.exec(path);
  const id = recipe?.[1];

  // Only canonical recipe details qualify; `/recipes/new` and nested routes
  // (edit, cooking sub-pages) stay unsupported by design.
  if (id && UUID_RE.test(id)) {
    return { kind: "recipe", id: id.toLowerCase() };
  }

  return { kind: "unsupported" };
}
