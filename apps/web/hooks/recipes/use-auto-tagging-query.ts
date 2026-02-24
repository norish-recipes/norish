"use client";

import { useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook that returns auto-tagging recipe IDs.
 *
 * Reads directly from the tRPC getPendingAutoTagging cache.
 * Real-time updates are handled by useRecipesCacheHelpers in subscription hooks.
 */
export function useAutoTaggingQuery() {
  const trpc = useTRPC();

  const { data, isLoading, error } = useQuery({
    ...trpc.recipes.getPendingAutoTagging.queryOptions(),
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const autoTaggingRecipeIds = useMemo(() => {
    const ids = Array.isArray(data) ? data : [];

    return new Set<string>(ids as string[]);
  }, [data]);

  return {
    autoTaggingRecipeIds,
    isLoading,
    error,
  };
}
