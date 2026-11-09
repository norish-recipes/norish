/** How many foods one read asks about: the procedure's own limit. */
const MAX_IDS = 500;

/**
 * The ids a surface's one `ingredients.icons` read asks about, the same whichever order its foods
 * come in, so a page's seed and the surface make the same read.
 */
export function iconIds(ids: readonly (string | null | undefined)[]): string[] {
  // ponytail: a surface past 500 foods shows no icons beyond them; page the read if one ever does.
  return [...new Set(ids.filter((id): id is string => !!id))]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_IDS);
}
