"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

const DEFAULT_SHARE_PUBLIC_CONFIG = {
  units: {},
  timersEnabled: true,
  timerKeywords: {
    enabled: true,
    hours: [],
    minutes: [],
    seconds: [],
    isOverridden: false,
  },
};

export function useSharePublicConfigQuery(token: string) {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.recipes.sharePublicConfig.queryOptions({ token }),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  return {
    units: data?.units ?? DEFAULT_SHARE_PUBLIC_CONFIG.units,
    timersEnabled: data?.timersEnabled ?? DEFAULT_SHARE_PUBLIC_CONFIG.timersEnabled,
    timerKeywords: data?.timerKeywords ?? DEFAULT_SHARE_PUBLIC_CONFIG.timerKeywords,
    isLoading,
    error,
  };
}
