"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

import type { UnitsMap } from "@norish/config/zod/server-config";

/**
 * Hook to fetch units configuration for ingredient parsing.
 * Used by client components that need to parse ingredients.
 */
export function useUnitsQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.units.queryOptions(),
    staleTime: 60 * 60 * 1000, // Units rarely change, cache for 1 hour
    gcTime: 60 * 60 * 1000,
  });

  return {
    units: (data ?? {}) as UnitsMap,
    isLoading,
    error,
  };
}
