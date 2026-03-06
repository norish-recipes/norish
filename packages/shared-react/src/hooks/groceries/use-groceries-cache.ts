import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { CreateGroceriesHooksOptions, GroceriesCacheHelpers, GroceriesData } from "./types";

export function createUseGroceriesCache({ useTRPC }: CreateGroceriesHooksOptions) {
  return function useGroceriesCacheHelpers(): GroceriesCacheHelpers {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.groceries.list.queryKey();

    const setGroceriesData = useCallback(
      (updater: (prev: GroceriesData | undefined) => GroceriesData | undefined) => {
        queryClient.setQueryData<GroceriesData>(queryKey, updater);
      },
      [queryClient, queryKey]
    );

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    return {
      setGroceriesData,
      invalidate,
    };
  };
}
