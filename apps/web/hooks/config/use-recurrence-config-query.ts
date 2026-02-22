"use client";

import type { RecurrenceConfig } from "@norish/shared/contracts/recurrence";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook to fetch recurrence configuration for natural language parsing.
 * Used by grocery panels for detecting recurrence patterns.
 */
export function useRecurrenceConfigQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.recurrenceConfig.queryOptions(),
    staleTime: 60 * 60 * 1000, // Config rarely changes, cache for 1 hour
    gcTime: 60 * 60 * 1000,
  });

  return {
    recurrenceConfig: data as RecurrenceConfig | undefined,
    isLoading,
    error,
  };
}
