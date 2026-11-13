import { useQuery } from "@tanstack/react-query";

import type { PantryIngredientDto } from "@norish/shared/contracts";

import type { PantryQueryResult } from "./types";
import { useTRPC } from "../trpc";

export function usePantryQuery(): PantryQueryResult {
  const trpc = useTRPC();
  const { data, error, isLoading, isFetching } = useQuery(trpc.pantry.list.queryOptions());
  const items = data ?? [];
  // A failed read with nothing cached is the one state a screen cannot tell
  // from an empty Pantry by the items alone.
  const isUnavailable = error != null && data === undefined;

  return { items, error, isLoading, isFetching, isUnavailable };
}

/** The Pantry's item for one Ingredient, or null: its reader re-renders only when that item changes. */
export function usePantryItem(ingredientId: string): PantryIngredientDto | null {
  const trpc = useTRPC();
  const { data = null } = useQuery({
    ...trpc.pantry.list.queryOptions(),
    select: (items) => items.find((item) => item.ingredientId === ingredientId) ?? null,
  });

  return data;
}
