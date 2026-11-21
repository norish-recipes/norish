"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

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
    /** The running imports, each with the link it was started from. */
    pendingRecipes: data ?? [],
    pendingRecipeIds,
    isLoading,
    error,
  };
}

/** Rereads the running imports, for a caller whose placeholders may name imports already done. */
export function useRereadPendingRecipes(): () => void {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return () => void queryClient.invalidateQueries({ queryKey: trpc.recipes.getPending.queryKey() });
}
