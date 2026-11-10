import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type {
  GroceryDto,
  PantryIngredientDto,
  RecurringGroceryDto,
} from "@norish/shared/contracts";
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

  return {
    groceries,
    recurringGroceries,
    recipeMap,
    error,
    isLoading,
    getRecipeNameForGrocery,
  };
}

/**
 * The ids on the list: its reader re-renders when a grocery comes or goes, not when one changes.
 * While `live` is false it isn't told of changes at all, and reads the list only when it renders.
 */
export function useGroceryIds(live = true): string[] {
  const trpc = useTRPC();
  const { data = [] } = useQuery({
    ...trpc.groceries.list.queryOptions(),
    select: (list) => list.groceries.map((grocery) => grocery.id),
    subscribed: live,
  });

  return data;
}

/** Whether the list holds any grocery: its reader re-renders only when that flips. */
export function useHasGroceries(): boolean {
  const trpc = useTRPC();
  const { data = false } = useQuery({
    ...trpc.groceries.list.queryOptions(),
    select: (list) => list.groceries.length > 0,
  });

  return data;
}

/** One grocery, or null once it is gone: its reader re-renders only when that row changes. */
export function useGroceryFor(groceryId: string | null): GroceryDto | null {
  const trpc = useTRPC();
  const { data = null } = useQuery({
    ...trpc.groceries.list.queryOptions(),
    select: (list) => list.groceries.find((g) => g.id === groceryId) ?? null,
  });

  return data;
}

/** A grocery's recurring row, or null: its reader re-renders only when that row changes. */
export function useRecurringGroceryFor(groceryId: string | null): RecurringGroceryDto | null {
  const trpc = useTRPC();
  const { data = null } = useQuery({
    ...trpc.groceries.list.queryOptions(),
    select: (list) => {
      const recurringId = list.groceries.find((g) => g.id === groceryId)?.recurringGroceryId;

      return list.recurringGroceries.find((recurring) => recurring.id === recurringId) ?? null;
    },
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
