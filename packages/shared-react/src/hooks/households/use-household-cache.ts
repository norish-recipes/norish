import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { CreateHouseholdHooksOptions, HouseholdCacheHelpers, HouseholdData } from "./types";

export function createUseHouseholdCache({ useTRPC }: CreateHouseholdHooksOptions) {
  return function useHouseholdCacheHelpers(): HouseholdCacheHelpers {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.households.get.queryKey();

    const setHouseholdData = useCallback(
      (updater: (prev: HouseholdData | undefined) => HouseholdData | undefined) => {
        queryClient.setQueryData<HouseholdData>(queryKey, updater);
      },
      [queryClient, queryKey]
    );

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    const invalidateCalendar = useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["calendar", "combined"] });
    }, [queryClient]);

    return {
      setHouseholdData,
      invalidate,
      invalidateCalendar,
    };
  };
}
