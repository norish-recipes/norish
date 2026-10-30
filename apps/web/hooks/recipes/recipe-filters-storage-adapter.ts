import { writeRecipeFiltersCookie } from "@/lib/recipe-filters-cookie";

import type { RecipeFiltersStorageAdapter } from "@norish/shared-react/hooks";
import {
  DEFAULT_PERSISTED_RECIPE_FILTERS,
  normalizePersistedRecipeFilters,
} from "@norish/shared-react/filter-contract";

export const RECIPE_FILTERS_STORAGE_KEY = "norish:recipe-filters";

// localStorage stays the browser's own copy; the cookie tells the server, so a full load draws the
// same list.
export const webRecipeFiltersStorageAdapter: RecipeFiltersStorageAdapter = {
  getItem: (key) => {
    if (typeof window === "undefined") return null;

    return window.localStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(key, value);
    writeRecipeFiltersCookie(
      normalizePersistedRecipeFilters(JSON.parse(value)) ?? DEFAULT_PERSISTED_RECIPE_FILTERS
    );
  },
  removeItem: (key) => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem(key);
    writeRecipeFiltersCookie(DEFAULT_PERSISTED_RECIPE_FILTERS);
  },
};
