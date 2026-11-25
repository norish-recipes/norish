import { useQuery } from "@tanstack/react-query";

import type { PickerKind } from "./entry-matching";
import { useTRPC } from "../trpc";

/**
 * The list a picker offers: the household's entries plus the instance's. With `recipeId` (one
 * being edited), that recipe's household's, as another household's recipe takes its entries.
 */
export function useListEntries(kind: PickerKind, recipeId?: string) {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery({
    ...trpc.lists.list.queryOptions({ kind, recipeId }),
    staleTime: 5 * 60 * 1000,
  });

  return { entries: data ?? [], error, isLoading };
}
