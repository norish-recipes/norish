"use client";

import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUserMutations } from "@/hooks/user/use-user-mutations";
import { useUserSettingsQuery } from "@/hooks/user/use-user-query";

import type { Locale } from "@norish/i18n/config";
import { isValidLocale } from "@norish/i18n/config";
import { getLocalePreference } from "@norish/shared/lib/user-preferences";

/**
 * Hook for managing user locale preference
 *
 * Reads locale from user preferences via useUserSettingsQuery.
 * Writes locale via useUserMutations.updatePreferences (with optimistic update/rollback).
 * After changing locale, refreshes the page to apply the new locale.
 */
export function useLocale() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { user } = useUserSettingsQuery();
  const { updatePreferences, isUpdatingPreferences } = useUserMutations();

  const locale = getLocalePreference(user);

  /**
   * Change the locale
   *
   * Saves to database via updatePreferences and refreshes the page to apply the new locale.
   */
  const changeLocale = useCallback(
    async (newLocale: Locale) => {
      if (!isValidLocale(newLocale)) {
        return;
      }

      await updatePreferences({ locale: newLocale });

      // Refresh the page to apply the new locale
      startTransition(() => {
        router.refresh();
      });
    },
    [updatePreferences, router]
  );

  return {
    /** Current locale from user preferences */
    locale: locale as Locale | null | undefined,
    /** Change the locale */
    changeLocale,
    /** Whether locale change is in progress */
    isChanging: isUpdatingPreferences || isPending,
  };
}

export type UseLocaleResult = ReturnType<typeof useLocale>;
