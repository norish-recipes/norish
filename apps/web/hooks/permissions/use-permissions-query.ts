"use client";

import { useCallback } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { AutoTaggingMode, RecipePermissionPolicy } from "@norish/config/zod/server-config";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("PermissionsQuery");

export interface PermissionsData {
  recipePolicy: RecipePermissionPolicy;
  isAIEnabled: boolean;
  householdUserIds: string[] | null;
  isServerAdmin: boolean;
  autoTaggingMode: AutoTaggingMode;
}

export function usePermissionsQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.permissions.get.queryKey();

  const { data, error, isLoading } = useQuery(trpc.permissions.get.queryOptions());

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  // Subscribe to policy updates (also triggered when AI config changes)
  useSubscription(
    trpc.permissions.onPolicyUpdated.subscriptionOptions(undefined, {
      onData: () => {
        // Invalidate ALL queries when policy changes
        // Policy affects recipe visibility, so all recipe-related queries must refetch
        log.debug("Permissions policy updated, invalidating all queries");
        queryClient.invalidateQueries();
      },
    })
  );

  return {
    data: data as PermissionsData | undefined,
    isLoading,
    error,
    invalidate,
  };
}
