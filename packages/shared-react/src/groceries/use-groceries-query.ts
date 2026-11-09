import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { GroceryDto, PantryIngredientDto } from "@norish/shared/contracts";
import { groceryOnTheList } from "@norish/shared/lib/pantry";

import type { GroceriesQueryResult } from "./types";
import { useSpellingRules } from "../config";
import { useTRPC } from "../trpc";

export function useGroceriesQuery(): GroceriesQueryResult {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery(trpc.groceries.list.queryOptions());

  const groceries = data?.groceries ?? [];
  const recurringGroceries = data?.recurringGroceries ?? [];

  const recipeMap = useMemo(() => data?.recipeMap ?? {}, [data?.recipeMap]);

  const getRecipeNameForGrocery = useCallback(
    (grocery: GroceryDto): string | null => {
      if (!grocery.recipeIngredientId) return null;
      const info = recipeMap[grocery.recipeIngredientId];

      return info?.recipeName ?? null;
    },
    [recipeMap]
  );

  const getRecurringGroceryForGrocery = (groceryId: string) => {
    const recurringId = groceries.find((grocery) => grocery.id === groceryId)?.recurringGroceryId;

    return recurringGroceries.find((recurring) => recurring.id === recurringId) ?? null;
  };

  return {
    groceries,
    recurringGroceries,
    recipeMap,
    error,
    isLoading,
    getRecipeNameForGrocery,
    getRecurringGroceryForGrocery,
  };
}

/** The ids on the list: its reader re-renders when a grocery comes or goes, not when one changes. */
export function useGroceryIds(): string[] {
  const trpc = useTRPC();
  const { data = [] } = useQuery({
    ...trpc.groceries.list.queryOptions(),
    select: (list) => list.groceries.map((grocery) => grocery.id),
  });

  return data;
}

/**
 * The ids of these Pantry foods that have a grocery still to buy. Its reader re-renders only
 * when that answer changes, not for every change to the list.
 */
export function useOnTheList(items: readonly PantryIngredientDto[]): string[] {
  const trpc = useTRPC();
  const rules = useSpellingRules();
  const { data = [] } = useQuery({
    ...trpc.groceries.list.queryOptions(),
    select: (list) =>
      items
        .filter((item) => groceryOnTheList(list.groceries, item, rules) !== null)
        .map((item) => item.id),
  });

  return data;
}
