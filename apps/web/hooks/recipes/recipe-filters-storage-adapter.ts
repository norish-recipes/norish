import { browserStorage } from "@/lib/browser-storage";
import { writeRecipeFiltersCookie } from "@/lib/recipe-filters-cookie";

import type { PlatformStorage } from "@norish/shared-react/platform";
import {
  DEFAULT_PERSISTED_RECIPE_FILTERS,
  normalizePersistedRecipeFilters,
} from "@norish/shared/contracts/filter-contract";

export const RECIPE_FILTERS_STORAGE_KEY = "norish:recipe-filters";

// localStorage stays the browser's own copy; the cookie tells the server, so a full load draws the
// same list.
export const webRecipeFiltersStorageAdapter: PlatformStorage = {
  getItem: browserStorage.getItem,
  setItem: (key, value) => {
    void browserStorage.setItem(key, value);
    writeRecipeFiltersCookie(
      normalizePersistedRecipeFilters(JSON.parse(value)) ?? DEFAULT_PERSISTED_RECIPE_FILTERS
    );
  },
  removeItem: (key) => {
    void browserStorage.removeItem(key);
    writeRecipeFiltersCookie(DEFAULT_PERSISTED_RECIPE_FILTERS);
  },
};
