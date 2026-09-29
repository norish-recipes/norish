import { foldName } from "./fold-name";

/**
 * What a search of the catalogue asks for, read from what a person typed:
 *
 * - `<cola>` — exactly that name or spelling, folded;
 * - a text with `%` in it — a pattern, `%` standing for anything: `%cola%`
 *   contains, `cola%` starts with, `%cola` ends with;
 * - anything else — a word starting that way: `cola` finds "cola" and
 *   "cola nut", never "chocolate".
 *
 * Every text is folded the way spellings are, so "creme" finds "Crème
 * fraîche". The patterns are `LIKE` patterns over a fold, with `_` taken
 * literally.
 */
export type IngredientSearch =
  { kind: "exact"; fold: string } | { kind: "like"; patterns: string[] };

/** A `LIKE` pattern's own characters, escaped so the person's text is matched as written. */
function literal(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function parseIngredientSearch(text: string): IngredientSearch | null {
  const trimmed = text.trim();

  if (trimmed === "") return null;

  const exact = /^<(.+)>$/.exec(trimmed);

  if (exact) {
    const fold = foldName(exact[1]);

    return fold ? { kind: "exact", fold } : null;
  }

  if (trimmed.includes("%")) {
    const pattern = trimmed
      .split("%")
      .map((part) => literal(foldName(part)))
      .join("%");

    return pattern.replace(/%/g, "") === "" ? null : { kind: "like", patterns: [pattern] };
  }

  const fold = foldName(trimmed);

  if (!fold) return null;

  return { kind: "like", patterns: [`${literal(fold)}%`, `% ${literal(fold)}%`] };
}
