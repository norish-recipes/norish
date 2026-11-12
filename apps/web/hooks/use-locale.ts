"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Locale } from "@norish/i18n/config";
import { isValidLocale } from "@norish/i18n/config";
import { usePreferencesMutation, useReader } from "@norish/shared-react/reader";
import { getLocalePreference } from "@norish/shared/lib/user-preferences";

/** The Reader's language, kept in their preferences; the page refreshes to render a new one. */
export function useLocale() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { user } = useReader();
  const { updatePreferences, isUpdatingPreferences } = usePreferencesMutation();

  const changeLocale = async (newLocale: string) => {
    if (!isValidLocale(newLocale)) return;

    await updatePreferences({ locale: newLocale });
    startTransition(() => router.refresh());
  };

  return {
    locale: getLocalePreference(user) as Locale | null | undefined,
    changeLocale,
    isChanging: isUpdatingPreferences || isPending,
  };
}

export type UseLocaleResult = ReturnType<typeof useLocale>;
