"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";
import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("pending-recipes-query");

// Key for storing pending recipe IDs in the query cache (shared state)
const PENDING_RECIPES_KEY = ["recipes", "pending"];

export function usePendingRecipesQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    ...trpc.recipes.getPending.queryOptions(),
    staleTime: 30_000, // Consider stale after 30 seconds
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data || data.length === 0) return;

    const pendingIds = data.map((job) => job.recipeId);

    log.debug({ count: pendingIds.length }, "Hydrating pending recipes from server");

    // Merge with existing pending IDs (don't overwrite, since real-time updates may have added new ones)
    queryClient.setQueryData<string[]>(PENDING_RECIPES_KEY, (prev) => {
      const existing = prev ?? [];
      const merged = [...new Set([...existing, ...pendingIds])];

      return merged;
    });
  }, [data, queryClient]);

  return {
    pendingRecipes: data ?? [],
    isLoading,
    error,
  };
}
