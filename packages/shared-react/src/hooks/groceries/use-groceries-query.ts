import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { GroceryDto } from "@norish/shared/contracts";

import type { CreateGroceriesHooksOptions, GroceriesData, GroceriesQueryResult } from "./types";

export function createUseGroceriesQuery({ useTRPC }: CreateGroceriesHooksOptions) {
  return function useGroceriesQuery(): GroceriesQueryResult {
    "use memo";

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
      // A read already under way answers for the list as it was: it must not
      // land over this write. The list stays stale, so the next mount or focus
      // reads it again. Stopping a read puts back what was held when it began,
      // which misses a list restored since (an offline load), so the write
      // applies to the list as held now. With nothing held there is nothing
      // to write over, and stopping the first read would leave it loading.
      const held = queryClient.getQueryData<GroceriesData>(queryKey);

      if (held) void queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<GroceriesData>(queryKey, updater(held));
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
