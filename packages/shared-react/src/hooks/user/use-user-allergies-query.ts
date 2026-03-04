import { useQuery } from "@tanstack/react-query";

import type { CreateUserHooksOptions } from "./types";

export function createUseUserAllergiesQuery({ useTRPC }: CreateUserHooksOptions) {
  return function useUserAllergiesQuery() {
    const trpc = useTRPC();
    const query = useQuery(trpc.user.getAllergies.queryOptions());

    return {
      allergies: query.data?.allergies ?? [],
      isLoading: query.isLoading,
      error: query.error,
    };
  };
}
