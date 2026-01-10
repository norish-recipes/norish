"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

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
    return new Set(data ?? []);
  }, [data]);

  return {
    allergyDetectionRecipeIds,
    isLoading,
    error,
  };
}
