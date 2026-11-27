import { useQuery } from "@tanstack/react-query";

import type { PickerKind } from "./entry-matching";
import { useHousehold } from "../reader";
import { useTRPC } from "../trpc";

/** The list a picker offers: the household's entries plus the instance's, or with `recipeId` that
 * recipe's household's. `loaded` is false until read; `failed` when the first read failed. */
export function useListEntries(kind: PickerKind, recipeId?: string) {
  const trpc = useTRPC();
  const { data, isError, refetch } = useQuery({
    ...trpc.lists.list.queryOptions({ kind, recipeId }),
    staleTime: 5 * 60 * 1000,
  });

  return {
    entries: data ?? [],
    loaded: data !== undefined,
    failed: isError && data === undefined,
    retry: () => void refetch(),
  };
}

/**
 * The `recipeId` a list read passes for a recipe being edited: only one of another household
 * (edit Everyone), so the reader's own recipes share the household list's cache.
 */
export function useListRecipeId(recipe?: { id: string; householdId: string }) {
  const { household } = useHousehold();

  if (!recipe) return undefined;

  return household?.id === recipe.householdId ? undefined : recipe.id;
}
