"use client";

import { sharedAdminHooks } from "./shared-admin-hooks";

export const useAdminConfigsQuery = sharedAdminHooks.useAdminConfigsQuery;
export const useUserRoleQuery = sharedAdminHooks.useUserRoleQuery;
export const useAvailableModelsQuery = sharedAdminHooks.useAvailableModelsQuery;
export const useAvailableTranscriptionModelsQuery =
  sharedAdminHooks.useAvailableTranscriptionModelsQuery;

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

export type { AdminConfigsData } from "@norish/shared-react/hooks";

/**
 * Query hook for recipe provenance processing status.
 */
export function useProvenanceStatusQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.admin.getProvenanceStatus.queryOptions(),
    refetchOnWindowFocus: true,
  });

  return {
    status: data ?? { total: 0, processed: 0 },
    error,
    isLoading,
    queryKey: trpc.admin.getProvenanceStatus.queryKey(),
  };
}
