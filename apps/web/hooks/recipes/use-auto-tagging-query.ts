"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

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
    return new Set(data ?? []);
  }, [data]);

  return {
    autoTaggingRecipeIds,
    isLoading,
    error,
  };
}
