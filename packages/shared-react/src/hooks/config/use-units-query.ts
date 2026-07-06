import { useQuery } from "@tanstack/react-query";

import type { CreateConfigHooksOptions } from "./types";

export function createUseUnitsQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useUnitsQuery() {
    const trpc = useTRPC();

    const { data, error, isLoading } = useQuery({
      ...trpc.config.units.queryOptions(),
      staleTime: 60 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

    return {
      units: data ?? {},
      isLoading,
      error,
    };
  };
}
