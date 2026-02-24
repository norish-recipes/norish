"use client";

import { useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook that returns pending recipe IDs.
 *
 * Reads directly from the tRPC getPending cache.
 * Real-time updates are handled by useRecipesCacheHelpers in subscription hooks.
 */
export function usePendingRecipesQuery() {
  const trpc = useTRPC();

  const { data, isLoading, error } = useQuery({
    ...trpc.recipes.getPending.queryOptions(),
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const pendingRecipeIds = useMemo(() => {
    return new Set((data ?? []).map((p) => p.recipeId));
  }, [data]);

  return {
    pendingRecipeIds,
    isLoading,
    error,
  };
}
