import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreatePantryHooksOptions, PantryData, PantryQueryResult } from "./types";

export function createUsePantryQuery({ useTRPC }: CreatePantryHooksOptions) {
  return function usePantryQuery(): PantryQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.pantry.list.queryKey();
    const { data, error, isLoading } = useQuery(trpc.pantry.list.queryOptions());
    const items = data ?? [];
    // A failed read with nothing cached is the one state a screen cannot tell
    // from an empty Pantry by the items alone.
    const isUnavailable = error != null && data === undefined;

    const setPantryData = (updater: (prev: PantryData | undefined) => PantryData | undefined) => {
      queryClient.setQueryData<PantryData>(queryKey, updater);
    };

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    return { items, error, isLoading, isUnavailable, queryKey, setPantryData, invalidate };
  };
}
