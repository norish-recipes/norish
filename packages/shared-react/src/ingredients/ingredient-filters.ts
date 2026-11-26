import type {
  IngredientSearchField,
  IngredientSearchMatch,
} from "@norish/shared/lib/ingredient-search";
import {
  DEFAULT_INGREDIENT_SEARCH_FIELDS,
  DEFAULT_INGREDIENT_SEARCH_MATCH,
} from "@norish/shared/lib/ingredient-search";

/** How the Ingredients list narrows, beyond the text typed. */
export interface IngredientFilters {
  match: IngredientSearchMatch;
  fields: IngredientSearchField[];
  flaggedOnly: boolean;
  /** Only the foods with neither a parent nor kinds: the ones a parent could be found for. */
  standaloneOnly: boolean;
  /** Whether the list is the tree of kinds, or every food flat. */
  tree: boolean;
}

export const DEFAULT_INGREDIENT_FILTERS: IngredientFilters = {
  match: DEFAULT_INGREDIENT_SEARCH_MATCH,
  fields: [...DEFAULT_INGREDIENT_SEARCH_FIELDS],
  flaggedOnly: false,
  standaloneOnly: false,
  tree: true,
};

/** Whether anything differs from the defaults, for the mark on the Filters button. */
export function hasIngredientFilters(filters: IngredientFilters): boolean {
  return (
    filters.flaggedOnly ||
    filters.standaloneOnly ||
    filters.tree !== DEFAULT_INGREDIENT_FILTERS.tree ||
    filters.match !== DEFAULT_INGREDIENT_FILTERS.match ||
    filters.fields.length !== DEFAULT_INGREDIENT_FILTERS.fields.length ||
    filters.fields.some((field) => !DEFAULT_INGREDIENT_FILTERS.fields.includes(field))
  );
}
