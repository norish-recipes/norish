/**
 * Where a page came from, carried in its own address.
 *
 * A back link is a fact about this visit rather than about the thing being
 * looked at: the same recipe is reached from the Library, from a cookbook and
 * from the calendar, and each of those wants a different way back. Putting it
 * in the URL means it survives a reload and the browser's own back button,
 * which a value held in memory does not.
 */
export const BACK_PARAM = "from";

/** A `from` names a place in this app, never a URL — anything else is dropped. */
export function safeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  // A single leading slash: "//evil.example" is a protocol-relative URL, and a
  // back link is not a way to leave the site.
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  return value;
}

/** The address of `href`, remembering that the reader is standing on `origin`. */
export function withOrigin(href: string, origin: string | null | undefined): string {
  const from = safeOrigin(origin);

  if (!from || from === href) return href;

  return `${href}?${BACK_PARAM}=${encodeURIComponent(from)}`;
}

/** The id in `/cookbooks/<id>`, or null when the path is something else. */
export function cookbookIdFromPath(path: string | null): string | null {
  return /^\/cookbooks\/([^/?#]+)$/.exec(path ?? "")?.[1] ?? null;
}

/** The id in `/recipes/<id>`, or null when the path is something else. */
export function recipeIdFromPath(path: string | null): string | null {
  return /^\/recipes\/([^/?#]+)$/.exec(path ?? "")?.[1] ?? null;
}
