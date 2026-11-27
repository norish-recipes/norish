/** Who resolves and why: a "person" write, an "upgrade" pass, a "repoint" of rows whose food went,
 * a "split" part AI found no food for, or a "read" that only looks and writes nothing. */
export type ResolveMode = "person" | "upgrade" | "repoint" | "split" | "read";

/** Whether a mode mints a text the catalogue does not know; "repoint" and "read" only find. */
export function mintsIn(mode: ResolveMode): boolean {
  return mode !== "repoint" && mode !== "read";
}
