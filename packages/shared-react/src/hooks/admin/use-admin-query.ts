import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  AIConfig,
  ServerConfigKey,
  TranscriptionProvider,
} from "@norish/config/zod/server-config";

import type { CreateAdminHooksOptions } from "./types";

export type AdminConfigsData = Record<ServerConfigKey, unknown>;

export function createUseAdminQuery({ useTRPC }: CreateAdminHooksOptions) {
  function useAdminConfigsQuery() {
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

  function useUserRoleQuery() {
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

  function useAvailableModelsQuery(options: {
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
      staleTime: 60000,
      retry: false,
    });

    return {
      models: data?.models ?? [],
      error,
      isLoading,
    };
  }

  function useAvailableTranscriptionModelsQuery(options: {
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
      staleTime: 60000,
      retry: false,
    });

    return {
      models: data?.models ?? [],
      error,
      isLoading,
    };
  }

  return {
    useAdminConfigsQuery,
    useUserRoleQuery,
    useAvailableModelsQuery,
    useAvailableTranscriptionModelsQuery,
  };
}
