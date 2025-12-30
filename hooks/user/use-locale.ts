"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";
import { type Locale, isValidLocale } from "@/i18n/config";

/**
 * Hook for managing user locale preference
 *
 * Saves preference to database for authenticated users.
 * After changing locale, refreshes the page to apply the new locale.
 */
export function useLocale() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get locale query (for authenticated users)
  const { data: localeData } = useQuery({
    ...trpc.user.getLocale.queryOptions(),
    // Don't retry on error (user might not be authenticated)
    retry: false,
    // Stale time of 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  // Set locale mutation (for authenticated users)
  const setLocaleMutation = useMutation({
    ...trpc.user.setLocale.mutationOptions(),
    onSuccess: () => {
      // Invalidate locale query
      queryClient.invalidateQueries({ queryKey: trpc.user.getLocale.queryKey() });
    },
  });

  /**
   * Change the locale
   *
   * Saves to database and refreshes the page to apply the new locale.
   */
  const changeLocale = useCallback(
    async (locale: Locale) => {
      if (!isValidLocale(locale)) {
        return;
      }

      // Save to database
      await setLocaleMutation.mutateAsync({ locale });

      // Refresh the page to apply the new locale
      startTransition(() => {
        router.refresh();
      });
    },
    [setLocaleMutation, router]
  );

  return {
    /** Current locale from database */
    locale: localeData?.locale as Locale | null | undefined,
    /** Change the locale */
    changeLocale,
    /** Whether locale change is in progress */
    isChanging: setLocaleMutation.isPending || isPending,
  };
}

export type UseLocaleResult = ReturnType<typeof useLocale>;
