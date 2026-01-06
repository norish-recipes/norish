"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook to fetch version information for update checking.
 * Checks on page load, caches for 1 hour.
 */
export function useVersionQuery() {
  const trpc = useTRPC();

  const { data, isLoading } = useQuery({
    ...trpc.config.version.queryOptions(),
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });

  return {
    currentVersion: data?.current ?? null,
    latestVersion: data?.latest ?? null,
    updateAvailable: data?.updateAvailable ?? false,
    releaseUrl: data?.releaseUrl ?? null,
    isLoading,
  };
}
