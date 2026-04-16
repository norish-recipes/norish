"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import type { ApiKeyMetadataDto } from "@norish/trpc";

export type UserSettingsData = {
  user: User;
  apiKeys: ApiKeyMetadataDto[];
  allergies: string[];
  allergiesVersion: number;
};

/**
 * Query hook for user settings (profile + API keys).
 */
export function useUserSettingsQuery() {
  const trpc = useTRPC();

  const queryKey = trpc.user.get.queryKey();
  const allergiesQueryKey = trpc.user.getAllergies.queryKey();

  const { data, error, isLoading } = useQuery(trpc.user.get.queryOptions());
  const { data: allergiesData, isLoading: isLoadingAllergies } = useQuery(
    trpc.user.getAllergies.queryOptions()
  );

  return {
    user: data?.user ?? null,
    apiKeys: data?.apiKeys ?? [],
    allergies: allergiesData?.allergies ?? [],
    allergiesVersion: allergiesData?.version ?? 0,
    error,
    isLoading: isLoading || isLoadingAllergies,
    queryKey,
    allergiesQueryKey,
  };
}
