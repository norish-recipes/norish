"use client";

import {
  createUseGroceriesMutations,
  createUseGroceriesQuery,
} from "@norish/shared-react/hooks/groceries";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUnitsQuery } from "@/hooks/config";


const useGroceriesQuery = createUseGroceriesQuery({ useTRPC });
const useSharedGroceriesMutations = createUseGroceriesMutations({
  useTRPC,
  useGroceriesQuery,
  useUnitsQuery,
});

export const useGroceriesMutations = useSharedGroceriesMutations;

export type { GroceriesMutationsResult, GroceryCreateData } from "@norish/shared-react/hooks";
