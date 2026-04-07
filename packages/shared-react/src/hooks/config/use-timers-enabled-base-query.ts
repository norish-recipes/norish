import { useQuery } from "@tanstack/react-query";

import type { CreateConfigHooksOptions } from "./types";

export function createUseTimersEnabledBaseQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useTimersEnabledBaseQuery() {
    const trpc = useTRPC();

    const { data, error, isLoading } = useQuery({
      ...trpc.config.timersEnabled.queryOptions(),
      staleTime: 5 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

    return {
      globalEnabled: data ?? true,
      isLoading,
      error,
    };
  };
}
