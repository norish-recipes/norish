import type { LibrarySuggestionsDTO } from "@norish/shared/contracts";
import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { MAX_FILTER_INGREDIENTS } from "@norish/shared/contracts/zod";
import { foldName } from "@norish/shared/lib/fold-name";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import { hasSearchText } from "@norish/shared/lib/search-terms";

/** How long the reader stops typing before suggestions are read, as web's search field waits. */
export const SUGGESTIONS_DEBOUNCE_MS = 300;

/** How many recipes the typing state suggests: the top of what the results would show. */
export const RECIPE_SUGGESTIONS = 2;

/** The text suggestions are read for: itself, or "" while it holds no word to look for. */
export const suggestionText = (text: string) => (hasSearchText(text) ? text.trim() : "");

/** How many Categories the typing state offers. */
const CATEGORY_ROWS = 3;

/** One "Narrow to" row: the filter it adds (a Category by its stored `name`) and the name it shows. */
export type NarrowRow =
  | { kind: "ingredient"; id: string; name: string }
  | { kind: "tag"; name: string }
  | { kind: "category"; name: string; label: string };

/** What the rows are read from: the suggestions, and how the reader's language shows a Category. */
export type NarrowSource = {
  suggestions: LibrarySuggestionsDTO | undefined;
  locale: string;
  /** The text typed: a Category matches by the label shown, which the server does not know. */
  text: string;
  categoryLabel: (name: string) => string;
};

/** The Categories whose shown label has a word starting with the text, folded, leaving out the
 * `applied` ones (lowercased) before the cap; at most three. */
export function matchingCategories(
  names: readonly string[],
  text: string,
  categoryLabel: (name: string) => string,
  applied: ReadonlySet<string> = new Set()
): string[] {
  const typed = foldName(text);

  if (!typed) return [];

  return names
    .filter((name) => {
      if (applied.has(name.toLowerCase())) return false;

      const label = foldName(categoryLabel(name));

      return label.startsWith(typed) || label.includes(` ${typed}`);
    })
    .slice(0, CATEGORY_ROWS);
}

type Applied = Pick<CanonicalRecipeFilters, "ingredients" | "searchTags" | "categories">;

/** The rows to narrow to, Ingredients then Tags then Categories; one already a chip is not offered
 * again, and no Ingredient is at the limit of Ingredient chips. */
export function narrowRows(
  { suggestions, locale, text, categoryLabel }: NarrowSource,
  applied: Applied
): NarrowRow[] {
  if (!suggestions) return [];

  const lowered = (names: readonly string[]) => new Set(names.map((name) => name.toLowerCase()));
  const tags = lowered(applied.searchTags);
  const categories = lowered(applied.categories);

  return [
    ...suggestions.ingredients
      .filter(
        (food) =>
          applied.ingredients.length < MAX_FILTER_INGREDIENTS &&
          !applied.ingredients.includes(food.id)
      )
      .map((food) => ({
        kind: "ingredient" as const,
        id: food.id,
        name: ingredientDisplayName(food, locale),
      })),
    ...suggestions.tags
      .filter((name) => !tags.has(name.toLowerCase()))
      .map((name) => ({ kind: "tag" as const, name })),
    ...matchingCategories(suggestions.categories, text, categoryLabel, categories).map((name) => ({
      kind: "category" as const,
      name,
      label: categoryLabel(name),
    })),
  ];
}

/** The filters a Tag or Category row adds; an Ingredient row is added through `useAddIngredient`. */
export function narrowPatch(
  row: Exclude<NarrowRow, { kind: "ingredient" }>,
  filters: Applied
): Partial<CanonicalRecipeFilters> {
  return row.kind === "tag"
    ? { searchTags: [...filters.searchTags, row.name] }
    : { categories: [...filters.categories, row.name] };
}

export const narrowRowKey = (row: NarrowRow) =>
  `${row.kind}-${row.kind === "ingredient" ? row.id : row.name}`;
