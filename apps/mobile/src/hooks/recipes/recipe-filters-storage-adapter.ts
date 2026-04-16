import { storage } from "@/lib/storage/mmkv";

import type { RecipeFiltersStorageAdapter } from "@norish/shared-react/hooks";

export const RECIPE_FILTERS_STORAGE_KEY = "norish:recipe-filters";

export const mobileRecipeFiltersStorageAdapter: RecipeFiltersStorageAdapter = {
  getItem: (key) => storage.getString(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
