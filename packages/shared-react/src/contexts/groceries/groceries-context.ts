import type { ReactNode } from "react";
import { createContext, createElement, useContext, useMemo } from "react";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

import type {
  GroceriesMutationsResult,
  GroceriesQueryResult,
  RecipeMap,
} from "../../hooks/groceries";

export type GroceriesContextValue = {
  // Data
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  doneGroceries: GroceryDto[];
  pendingGroceries: GroceryDto[];
  isLoading: boolean;
  recipeMap: RecipeMap;
  getRecipeNameForGrocery: (grocery: GroceryDto) => string | null;
} & GroceriesMutationsResult;

type CreateGroceriesContextOptions = {
  useGroceriesQuery: () => GroceriesQueryResult;
  useGroceriesMutations: () => GroceriesMutationsResult;
  useGroceriesSubscription: () => void;
};

export function createGroceriesContext({
  useGroceriesQuery,
  useGroceriesMutations,
  useGroceriesSubscription,
}: CreateGroceriesContextOptions) {
  const GroceriesContext = createContext<GroceriesContextValue | null>(null);

  function GroceriesProvider({ children }: { children: ReactNode }) {
    const { groceries, recurringGroceries, recipeMap, isLoading, getRecipeNameForGrocery } =
      useGroceriesQuery();
    const groceryMutations = useGroceriesMutations();

    // Subscribe to WebSocket events (updates query cache via internal cache helpers)
    useGroceriesSubscription();

    // Computed: done groceries (non-recurring checked items)
    const doneGroceries = useMemo(
      () => groceries.filter((g) => g.isDone && !g.recurringGroceryId),
      [groceries]
    );

    // Computed: pending groceries (unchecked + checked recurring sorted by nextPlannedFor)
    const pendingGroceries = useMemo(() => {
      const unchecked = groceries.filter((g) => !g.isDone);
      const checkedRecurring = groceries.filter((g) => g.isDone && g.recurringGroceryId);

      // Sort checked recurring by nextPlannedFor date
      const sortedChecked = [...checkedRecurring].sort((a, b) => {
        const recurringA = recurringGroceries.find((r) => r.id === a.recurringGroceryId);
        const recurringB = recurringGroceries.find((r) => r.id === b.recurringGroceryId);

        if (!recurringA || !recurringB) return 0;

        return recurringA.nextPlannedFor.localeCompare(recurringB.nextPlannedFor);
      });

      return [...unchecked, ...sortedChecked];
    }, [groceries, recurringGroceries]);

    const value = useMemo<GroceriesContextValue>(
      () => ({
        groceries,
        recurringGroceries,
        doneGroceries,
        pendingGroceries,
        isLoading,
        recipeMap,
        getRecipeNameForGrocery,
        ...groceryMutations,
      }),
      [
        groceries,
        recurringGroceries,
        doneGroceries,
        pendingGroceries,
        isLoading,
        recipeMap,
        getRecipeNameForGrocery,
        groceryMutations,
      ]
    );

    return createElement(GroceriesContext.Provider, { value }, children);
  }

  function useGroceriesContext() {
    const ctx = useContext(GroceriesContext);

    if (!ctx) throw new Error("useGroceriesContext must be used within GroceriesProvider");

    return ctx;
  }

  return {
    GroceriesProvider,
    useGroceriesContext,
  };
}
