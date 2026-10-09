import { foldName } from "./fold-name";

/**
 * How a search of the catalogue reads what was typed: `contains` finds every
 * Ingredient with the text anywhere in it, `exact` only one spelled exactly
 * that way. There is no syntax to learn — the mode is a button on the page.
 */
export const INGREDIENT_SEARCH_MATCHES = ["contains", "exact"] as const;
export type IngredientSearchMatch = (typeof INGREDIENT_SEARCH_MATCHES)[number];

/**
 * Where a search looks: the Ingredient's own name, its translations (every
 * spelling in every language), or its parent's name and translations. At
 * least one field is always searched.
 */
export const INGREDIENT_SEARCH_FIELDS = ["name", "translations", "parent"] as const;
export type IngredientSearchField = (typeof INGREDIENT_SEARCH_FIELDS)[number];

export const DEFAULT_INGREDIENT_SEARCH_MATCH: IngredientSearchMatch = "contains";
export const DEFAULT_INGREDIENT_SEARCH_FIELDS: readonly IngredientSearchField[] = [
  "name",
  "translations",
];

/**
 * What a search of the catalogue asks for. `fold` is the typed text folded the
 * way spellings are, so "creme" finds "Crème fraîche"; `pattern` is that fold
 * as a `LIKE` pattern for the match, with `%` and `_` in the text escaped so
 * it is matched as written.
 */
export interface IngredientSearch {
  fold: string;
  pattern: string;
  match: IngredientSearchMatch;
  fields: IngredientSearchField[];
}

/** A `LIKE` pattern's own characters, escaped so the person's text is matched as written. */
function literal(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function parseIngredientSearch(
  text: string,
  options: { match?: IngredientSearchMatch; fields?: readonly IngredientSearchField[] } = {}
): IngredientSearch | null {
  const fold = foldName(text.trim());
  const match = options.match ?? DEFAULT_INGREDIENT_SEARCH_MATCH;
  const fields = [...(options.fields ?? DEFAULT_INGREDIENT_SEARCH_FIELDS)];

  if (!fold || fields.length === 0) return null;

  return {
    fold,
    pattern: match === "exact" ? literal(fold) : `%${literal(fold)}%`,
    match,
    fields,
  };
}

/**
 * Toggle one field of a search, never down to none: the last field stays,
 * as the dashboard's "Search in" chips do.
 */
export function toggleIngredientSearchField(
  fields: readonly IngredientSearchField[],
  field: IngredientSearchField
): IngredientSearchField[] {
  if (!fields.includes(field)) return [...fields, field];
  if (fields.length <= 1) return [...fields];

  return fields.filter((each) => each !== field);
}
