"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

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
