"use client";

import type { ServerConfigKey } from "@/server/db/zodSchemas/server-config";
import type { AIConfig, TranscriptionProvider } from "@/server/db/zodSchemas/server-config";

import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type AdminConfigsData = Record<ServerConfigKey, unknown>;

/**
 * Query hook for all server configs.
 * Returns configs with sensitive fields masked.
 */
export function useAdminConfigsQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.admin.getAllConfigs.queryKey();

  const { data, error, isLoading } = useQuery(trpc.admin.getAllConfigs.queryOptions());

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    configs: (data ?? {}) as AdminConfigsData,
    error,
    isLoading,
    queryKey,
    invalidate,
  };
}

/**
 * Query hook for user's admin role.
 * Used to determine if admin tab should show.
 */
export function useUserRoleQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery(trpc.admin.getUserRole.queryOptions());

  return {
    isOwner: data?.isOwner ?? false,
    isAdmin: data?.isAdmin ?? false,
    isServerAdmin: (data?.isOwner || data?.isAdmin) ?? false,
    error,
    isLoading,
  };
}

/**
 * Query hook for available AI models.
 * Fetches models from the configured provider's API.
 */
export function useAvailableModelsQuery(options: {
  provider: AIConfig["provider"];
  endpoint?: string;
  apiKey?: string;
  enabled?: boolean;
}) {
  const trpc = useTRPC();
  const { provider, endpoint, apiKey, enabled = true } = options;

  const { data, error, isLoading } = useQuery({
    ...trpc.admin.listAvailableModels.queryOptions({
      provider,
      endpoint,
      apiKey,
    }),
    enabled: enabled && !!provider,
    staleTime: 60000, // Cache for 1 minute
    retry: false, // Don't retry on failure (endpoint may be unavailable)
  });

  return {
    models: data?.models ?? [],
    error,
    isLoading,
  };
}

/**
 * Query hook for available transcription models.
 * Fetches whisper/transcription models from the configured provider's API.
 */
export function useAvailableTranscriptionModelsQuery(options: {
  provider: TranscriptionProvider;
  endpoint?: string;
  apiKey?: string;
  enabled?: boolean;
}) {
  const trpc = useTRPC();
  const { provider, endpoint, apiKey, enabled = true } = options;

  const { data, error, isLoading } = useQuery({
    ...trpc.admin.listAvailableTranscriptionModels.queryOptions({
      provider,
      endpoint,
      apiKey,
    }),
    enabled: enabled && provider !== "disabled",
    staleTime: 60000, // Cache for 1 minute
    retry: false, // Don't retry on failure (endpoint may be unavailable)
  });

  return {
    models: data?.models ?? [],
    error,
    isLoading,
  };
}
