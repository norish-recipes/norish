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

    const invalidateUserSettings = useCallback(() => {
      queryClient.invalidateQueries({ queryKey: trpc.user.get.queryKey() });
    }, [queryClient, trpc]);

    const invalidateRecipes = useCallback(() => {
      // Path-level prefix: catches list and detail queries, whose payloads
      // carry the recipe author's profile
      queryClient.invalidateQueries({ queryKey: [["recipes"]] });
    }, [queryClient]);

    return {
      setHouseholdData,
      invalidate,
      invalidateCalendar,
      invalidateUserSettings,
      invalidateRecipes,
    };
  };
}
