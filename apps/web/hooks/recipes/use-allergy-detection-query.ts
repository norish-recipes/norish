"use client";

import { useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook that returns allergy detection recipe IDs.
 *
 * Reads directly from the tRPC getPendingAllergyDetection cache.
 * Real-time updates are handled by useRecipesCacheHelpers in subscription hooks.
 */
export function useAllergyDetectionQuery() {
  const trpc = useTRPC();

  const { data, isLoading, error } = useQuery({
    ...trpc.recipes.getPendingAllergyDetection.queryOptions(),
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const allergyDetectionRecipeIds = useMemo(() => {
    const ids = Array.isArray(data) ? data : [];

    return new Set<string>(ids as string[]);
  }, [data]);

  return {
    allergyDetectionRecipeIds,
    isLoading,
    error,
  };
}
