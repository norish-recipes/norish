import { writeRecipeFiltersCookie } from "@/lib/recipe-filters-cookie";

import type {
  CanonicalRecipeFilters,
  PersistedRecipeFilters,
} from "@norish/shared/contracts/filter-contract";
import { normalizePersistedRecipeFilters } from "@norish/shared/contracts/filter-contract";

const RECIPE_FILTERS_STORAGE_KEY = "norish:recipe-filters";

/** The browser's own copy of the Library filters; null when there is none or it doesn't parse. */
export function readStoredRecipeFilters(): PersistedRecipeFilters | null {
  try {
    const stored = window.localStorage.getItem(RECIPE_FILTERS_STORAGE_KEY);

    return stored ? normalizePersistedRecipeFilters(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

// localStorage stays the browser's own copy; the cookie tells the server, so a full load draws the
// same list.
export function persistRecipeFilters({ rawInput: _rawInput, ...filters }: CanonicalRecipeFilters) {
  window.localStorage.setItem(RECIPE_FILTERS_STORAGE_KEY, JSON.stringify(filters));
  writeRecipeFiltersCookie(filters);
}
