"use client";

import { sharedGroceriesHooks } from "./shared-groceries-hooks";

export const useGroceriesMutations = sharedGroceriesHooks.useGroceriesMutations;

export type { GroceriesMutationsResult, GroceryCreateData } from "@norish/shared-react/hooks";
