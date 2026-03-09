import { useQuery } from "@tanstack/react-query";

import type { CreateConfigHooksOptions } from "./types";

export function createUseRecurrenceConfigQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useRecurrenceConfigQuery() {
    const trpc = useTRPC();

    const { data, error, isLoading } = useQuery({
      ...trpc.config.recurrenceConfig.queryOptions(),
      staleTime: 60 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

    return {
      recurrenceConfig: data,
      isLoading,
      error,
    };
  };
}
