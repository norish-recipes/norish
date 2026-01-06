"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export interface EnabledLocale {
  code: string;
  name: string;
}

export interface LocaleConfigResult {
  defaultLocale: string;
  enabledLocales: EnabledLocale[];
}

/**
 * Hook to fetch public locale configuration.
 * Works for both authenticated and unauthenticated users.
 *
 * Used by language switchers to know which locales are enabled.
 */
export function useLocaleConfigQuery() {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery({
    ...trpc.config.localeConfig.queryOptions(),
    staleTime: 60 * 60 * 1000, // Locale config rarely changes, cache for 1 hour
    gcTime: 60 * 60 * 1000,
  });

  return {
    localeConfig: data as LocaleConfigResult | undefined,
    enabledLocales: data?.enabledLocales ?? [],
    defaultLocale: data?.defaultLocale ?? "en",
    isLoading,
    error,
  };
}
