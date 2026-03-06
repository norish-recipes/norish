import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { CreateStoresHooksOptions, StoresCacheHelpers, StoresData } from "./types";

export function createUseStoresCache({ useTRPC }: CreateStoresHooksOptions) {
  return function useStoresCacheHelpers(): StoresCacheHelpers {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.stores.list.queryKey();

    const setStoresData = useCallback(
      (updater: (prev: StoresData | undefined) => StoresData | undefined) => {
        queryClient.setQueryData<StoresData>(queryKey, updater);
      },
      [queryClient, queryKey]
    );

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return { setStoresData, invalidate };
  };
}
