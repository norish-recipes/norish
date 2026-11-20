import type { CanonicalRecipeFilters } from "@norish/shared/contracts/filter-contract";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";
import { searchWords } from "@norish/shared/lib/search-terms";

/** How long the reader stops typing before suggestions are read, as web's search field waits. */
export const SUGGESTIONS_DEBOUNCE_MS = 300;

/** How many recipes the typing state suggests: the top of what the results would show. */
export const RECIPE_SUGGESTIONS = 2;

/** The text suggestions are read for: itself, or "" while it holds no word to look for. */
export const suggestionText = (text: string) => (searchWords(text).length > 0 ? text.trim() : "");

/** One "Narrow to" row: the filter it adds, and for an Ingredient the name its chip shows. */
export type NarrowRow =
  | { kind: "ingredient"; id: string; name: string }
  | { kind: "tag"; name: string }
  | { kind: "category"; name: string };

export type NarrowSuggestions = {
  ingredients: { id: string; name: string; localeNames: Record<string, string> }[];
  tags: string[];
  categories: string[];
};

type Applied = Pick<CanonicalRecipeFilters, "ingredients" | "searchTags" | "categories">;

/** The rows to narrow to, Ingredients then Tags then Categories; one already a chip is not offered again. */
export function narrowRows(
  suggestions: NarrowSuggestions | undefined,
  applied: Applied,
  locale: string
): NarrowRow[] {
  if (!suggestions) return [];

  const lowered = (names: readonly string[]) => new Set(names.map((name) => name.toLowerCase()));
  const tags = lowered(applied.searchTags);
  const categories = lowered(applied.categories);

  return [
    ...suggestions.ingredients
      .filter((food) => !applied.ingredients.includes(food.id))
      .map((food) => ({
        kind: "ingredient" as const,
        id: food.id,
        name: ingredientDisplayName(food, locale),
      })),
    ...suggestions.tags
      .filter((name) => !tags.has(name.toLowerCase()))
      .map((name) => ({ kind: "tag" as const, name })),
    ...suggestions.categories
      .filter((name) => !categories.has(name.toLowerCase()))
      .map((name) => ({ kind: "category" as const, name })),
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
