import type { RecipeFiltersStorageAdapter } from "@norish/shared-react/hooks";

export const RECIPE_FILTERS_STORAGE_KEY = "norish:recipe-filters";

export const webRecipeFiltersStorageAdapter: RecipeFiltersStorageAdapter = {
  getItem: (key) => {
    if (typeof window === "undefined") return null;

    return window.localStorage.getItem(key);
  },
  setItem: (key, value) => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem(key);
  },
};
