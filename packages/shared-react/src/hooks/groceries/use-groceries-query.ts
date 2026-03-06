import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { GroceryDto } from "@norish/shared/contracts";

import type { CreateGroceriesHooksOptions, GroceriesData, GroceriesQueryResult } from "./types";

export function createUseGroceriesQuery({ useTRPC }: CreateGroceriesHooksOptions) {
  return function useGroceriesQuery(): GroceriesQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const queryKey = trpc.groceries.list.queryKey();

    const { data, error, isLoading } = useQuery(trpc.groceries.list.queryOptions());

    const groceries = data?.groceries ?? [];
    const recurringGroceries = data?.recurringGroceries ?? [];

    const recipeMap = useMemo(() => data?.recipeMap ?? {}, [data?.recipeMap]);

    const setGroceriesData = (
      updater: (prev: GroceriesData | undefined) => GroceriesData | undefined
    ) => {
      queryClient.setQueryData<GroceriesData>(queryKey, updater);
    };

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    const getRecipeNameForGrocery = useCallback(
      (grocery: GroceryDto): string | null => {
        if (!grocery.recipeIngredientId) return null;
        const info = recipeMap[grocery.recipeIngredientId];

        return info?.recipeName ?? null;
      },
      [recipeMap]
    );

    return {
      groceries,
      recurringGroceries,
      recipeMap,
      error,
      isLoading,
      queryKey,
      setGroceriesData,
      invalidate,
      getRecipeNameForGrocery,
    };
  };
}
