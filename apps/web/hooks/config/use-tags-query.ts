"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch all unique tags
 * Used by tag input and filter components
 */
export function useTagsQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.tags.queryOptions(),
    staleTime: 5 * 60 * 1000, // Tags rarely change, cache for 5 minutes
  });

  return {
    tags: data?.tags ?? [],
    error,
    isLoading,
  };
}
