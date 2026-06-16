import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { CreateHouseholdHooksOptions, HouseholdData, HouseholdQueryResult } from "./types";

export function createUseHouseholdQuery({ useTRPC }: CreateHouseholdHooksOptions) {
  return function useHouseholdQuery(): HouseholdQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const queryKey = trpc.households.get.queryKey();

    const { data, error, isLoading } = useQuery(trpc.households.get.queryOptions());

    const household = data?.household ?? null;
    const currentUserId = data?.currentUserId;

    const setHouseholdData = (
      updater: (prev: HouseholdData | undefined) => HouseholdData | undefined
    ) => {
      queryClient.setQueryData<HouseholdData>(queryKey, updater);
    };

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    return {
      household,
      currentUserId,
      error,
      isLoading,
      queryKey,
      setHouseholdData,
      invalidate,
    };
  };
}
