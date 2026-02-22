"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook to get timer keywords configuration.
 */
export function useTimerKeywordsQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.timerKeywords.queryOptions(),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  return {
    timerKeywords: data ?? {
      enabled: true,
      hours: [],
      minutes: [],
      seconds: [],
      isOverridden: false,
    },
    isLoading,
    error,
  };
}
