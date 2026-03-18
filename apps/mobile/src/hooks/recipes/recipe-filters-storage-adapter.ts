import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RecipeFiltersStorageAdapter } from '@norish/shared-react/hooks';

export const RECIPE_FILTERS_STORAGE_KEY = 'norish:recipe-filters';

export const mobileRecipeFiltersStorageAdapter: RecipeFiltersStorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
