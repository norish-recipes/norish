"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook to check if recipe timers are enabled globally.
 */
export function useTimersEnabledQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.timersEnabled.queryOptions(),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  return {
    timersEnabled: data ?? true,
    isLoading,
    error,
  };
}
