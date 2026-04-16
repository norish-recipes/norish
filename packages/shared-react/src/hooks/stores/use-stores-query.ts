import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateStoresHooksOptions, StoresData, StoresQueryResult } from "./types";

export function createUseStoresQuery({ useTRPC }: CreateStoresHooksOptions) {
  return function useStoresQuery(): StoresQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.stores.list.queryKey();
    const { data, error, isLoading } = useQuery(trpc.stores.list.queryOptions());
    const stores = data ?? [];

    const setStoresData = (updater: (prev: StoresData | undefined) => StoresData | undefined) => {
      queryClient.setQueryData<StoresData>(queryKey, updater);
    };

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    return { stores, error, isLoading, queryKey, setStoresData, invalidate };
  };
}
