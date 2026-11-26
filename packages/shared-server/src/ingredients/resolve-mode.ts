/**
 * Who resolves and why: a "person"'s write (AI's pass follows a mint), an "upgrade" pass (mints so
 * flagged), a "repoint" of rows whose food went (no slip, no mint), a "split" part AI found no food for (no slip),
 * a "read" that only looks (no slip, no mint, no write).
 */
export type ResolveMode = "person" | "upgrade" | "repoint" | "split" | "read";

/** Whether a mode mints a text the catalogue does not know; "repoint" and "read" only find. */
export function mintsIn(mode: ResolveMode): boolean {
  return mode !== "repoint" && mode !== "read";
}
