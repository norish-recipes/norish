"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useOptionalUserContext } from "@/context/user-context";

/**
 * Hook to check if recipe timers are enabled globally AND for the current user.
 * Logic: globalEnabled AND (userPreference ?? true)
 */
export function useTimersEnabledQuery() {
  const trpc = useTRPC();

  // Optionally access user context if present (some render paths may not include provider)
  const user = useOptionalUserContext()?.user;

  const { data, error, isLoading } = useQuery({
    ...trpc.config.timersEnabled.queryOptions(),
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const globalEnabled = data ?? true;
  const userPrefEnabled = (user?.preferences as any)?.timersEnabled;

  const effective =
    globalEnabled && (typeof userPrefEnabled === "boolean" ? userPrefEnabled : true);

  return {
    timersEnabled: effective, // effective result (global AND userPref)
    globalEnabled,
    isLoading,
    error,
  };
}
