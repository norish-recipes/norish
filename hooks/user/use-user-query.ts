"use client";

import type { User } from "@/types";
import type { ApiKeyMetadataDto } from "@/server/trpc/routers/user/types";

import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type UserSettingsData = {
  user: User;
  apiKeys: ApiKeyMetadataDto[];
  allergies: string[];
};

/**
 * Query hook for user settings (profile + API keys).
 * Provides cache setter and invalidate helpers for mutations.
 */
export function useUserSettingsQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.user.get.queryKey();
  const allergiesQueryKey = trpc.user.getAllergies.queryKey();

  const { data, error, isLoading } = useQuery(trpc.user.get.queryOptions());
  const { data: allergiesData, isLoading: isLoadingAllergies } = useQuery(
    trpc.user.getAllergies.queryOptions()
  );

  // Cache setter for optimistic updates
  const setUserSettingsData = (
    updater: (prev: UserSettingsData | undefined) => UserSettingsData | undefined
  ) => {
    queryClient.setQueryData<UserSettingsData>(queryKey, updater);
  };

  // Invalidate to refetch (used for error rollback)
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    user: data?.user ?? null,
    apiKeys: data?.apiKeys ?? [],
    allergies: allergiesData?.allergies ?? [],
    error,
    isLoading: isLoading || isLoadingAllergies,
    queryKey,
    allergiesQueryKey,
    setUserSettingsData,
    invalidate,
  };
}
