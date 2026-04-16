"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUnitsQuery } from "@/hooks/config";

import {
  createUseGroceriesMutations,
  createUseGroceriesQuery,
} from "@norish/shared-react/hooks/groceries";

const useGroceriesQuery = createUseGroceriesQuery({ useTRPC });
const useSharedGroceriesMutations = createUseGroceriesMutations({
  useTRPC,
  useGroceriesQuery,
  useUnitsQuery,
});

export const useGroceriesMutations = useSharedGroceriesMutations;

export type { GroceriesMutationsResult, GroceryCreateData } from "@norish/shared-react/hooks";
