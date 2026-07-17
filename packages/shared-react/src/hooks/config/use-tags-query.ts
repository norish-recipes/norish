import { useQuery } from "@tanstack/react-query";

import type { CreateConfigHooksOptions } from "./types";

export type TagsQueryOptions = {
  enabled?: boolean;
};

export function createUseTagsQuery({ useTRPC }: CreateConfigHooksOptions) {
  return function useTagsQuery({ enabled = true }: TagsQueryOptions = {}) {
    const trpc = useTRPC();

    const { data, error, isLoading } = useQuery({
      ...trpc.config.tags.queryOptions(),
      enabled,
      refetchOnMount: true,
      staleTime: 5 * 60 * 1000,
    });

    return {
      tags: data?.tags ?? [],
      error,
      isLoading,
    };
  };
}
