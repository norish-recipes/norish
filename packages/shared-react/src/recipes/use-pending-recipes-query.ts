"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

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
    pendingRecipeIds,
    isLoading,
    error,
  };
}
