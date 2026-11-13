import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

export function useTagsQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.tags.queryOptions(),
    staleTime: 5 * 60 * 1000,
  });

  return {
    tags: data?.tags ?? [],
    error,
    isLoading,
  };
}
