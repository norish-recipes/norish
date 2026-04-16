"use client";

import { sharedGroceriesHooks } from "./shared-groceries-hooks";

export const useGroceriesQuery = sharedGroceriesHooks.useGroceriesQuery;

export type {
  GroceriesData,
  GroceriesQueryResult,
  RecipeInfo,
  RecipeMap,
} from "@norish/shared-react/hooks";
