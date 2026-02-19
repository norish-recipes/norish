"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";
import { getTimersEnabledPreference } from "@/lib/user-preferences";

/**
 * Hook to check if recipe timers are enabled globally AND for the current user.
 * Logic: globalEnabled AND (userPreference ?? true)
 */
export function useTimersEnabledQuery() {
  const trpc = useTRPC();

  const user = useUserContext().user;

  const { data, error, isLoading } = useQuery({
    ...trpc.config.timersEnabled.queryOptions(),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const globalEnabled = data ?? true;
  const userPrefEnabled = getTimersEnabledPreference(user);

  const isTimersEnabled = globalEnabled && userPrefEnabled;

  return {
    timersEnabled: isTimersEnabled,
    globalEnabled,
    isLoading,
    error,
  };
}
