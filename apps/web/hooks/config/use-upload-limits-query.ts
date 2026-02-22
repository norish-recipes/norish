"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Upload size limits returned from server configuration.
 */
export interface UploadLimits {
  maxAvatarSize: number;
  maxImageSize: number;
  maxVideoSize: number;
}

/**
 * Default fallback values used while loading or on error.
 * These match the server defaults.
 */
const DEFAULT_LIMITS: UploadLimits = {
  maxAvatarSize: 5 * 1024 * 1024, // 5MB
  maxImageSize: 10 * 1024 * 1024, // 10MB
  maxVideoSize: 100 * 1024 * 1024, // 100MB
};

/**
 * Hook to fetch upload size limits from server configuration.
 * Limits are configurable via environment variables on the server.
 *
 * @returns Upload limits with loading state
 */
export function useUploadLimitsQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.uploadLimits.queryOptions(),
    staleTime: 60 * 60 * 1000, // Limits rarely change, cache for 1 hour
    gcTime: 60 * 60 * 1000,
  });

  return {
    limits: data ?? DEFAULT_LIMITS,
    isLoading,
    error,
  };
}
