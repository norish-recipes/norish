"use client";

import { sharedGroceriesHooks } from "./shared-groceries-hooks";

export const useGroceriesQuery = sharedGroceriesHooks.useGroceriesQuery;
export type {
  GroceriesData,
  GroceriesQueryResult,
  RecipeMap,
  RecipeInfo,
} from "@norish/shared-react/hooks";

export const useGroceriesMutations = sharedGroceriesHooks.useGroceriesMutations;
export type { GroceriesMutationsResult, GroceryCreateData } from "@norish/shared-react/hooks";

export const useGroceriesSubscription = sharedGroceriesHooks.useGroceriesSubscription;

export const useGroceriesCacheHelpers = sharedGroceriesHooks.useGroceriesCacheHelpers;
export type { GroceriesCacheHelpers } from "@norish/shared-react/hooks";

// Web-only hook — depends on browser DnD APIs
export { useGroupedGroceryDnd } from "./use-grouped-grocery-dnd";
