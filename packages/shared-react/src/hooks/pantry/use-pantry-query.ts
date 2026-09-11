import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreatePantryHooksOptions, PantryData, PantryQueryResult } from "./types";

export function createUsePantryQuery({ useTRPC }: CreatePantryHooksOptions) {
  return function usePantryQuery(): PantryQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.pantry.list.queryKey();
    const { data, error, isLoading } = useQuery(trpc.pantry.list.queryOptions());
    const items = data ?? [];

    const setPantryData = (updater: (prev: PantryData | undefined) => PantryData | undefined) => {
      queryClient.setQueryData<PantryData>(queryKey, updater);
    };

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    return { items, error, isLoading, queryKey, setPantryData, invalidate };
  };
}
