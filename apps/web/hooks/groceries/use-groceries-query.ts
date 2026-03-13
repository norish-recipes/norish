"use client";

import type { QueryKey } from "@tanstack/react-query";
import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";


export type RecipeInfo = {
  recipeId: string;
  recipeName: string;
};

export type RecipeMap = Record<string, RecipeInfo>;

export type GroceriesData = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  recipeMap: RecipeMap;
};

export type GroceriesQueryResult = {
  groceries: GroceryDto[];
  recurringGroceries: RecurringGroceryDto[];
  recipeMap: RecipeMap;
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  setGroceriesData: (
    updater: (prev: GroceriesData | undefined) => GroceriesData | undefined
  ) => void;
  invalidate: () => void;
  getRecipeNameForGrocery: (grocery: GroceryDto) => string | null;
};

export function useGroceriesQuery(): GroceriesQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.groceries.list.queryKey();

  const { data, error, isLoading } = useQuery(trpc.groceries.list.queryOptions());

  const groceries = data?.groceries ?? [];
  const recurringGroceries = data?.recurringGroceries ?? [];

  // Wrap recipeMap in useMemo to prevent dependency changes on every render
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
}
