"use client";

import { useCallback, useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";

import { type Locale, isValidLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { useLocaleConfigQuery } from "@/hooks/config";

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/**
 * Get locale from cookie
 */
function getLocaleFromCookie(fallback: Locale): Locale {
  if (typeof document === "undefined") {
    return fallback;
  }

  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");

    if (name === LOCALE_COOKIE_NAME && isValidLocale(value)) {
      return value;
    }
  }

  return fallback;
}

/**
 * Set locale cookie (client-side)
 */
function setLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") {
    return;
  }

  // Set cookie with 1 year expiry
  const expires = new Date();

  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale};path=/;expires=${expires.toUTCString()};SameSite=Lax`;
}

/**
 * Hook for managing locale via cookie (for unauthenticated users)
 *
 * Used on login/signup pages where user is not authenticated.
 * After changing locale, refreshes the page to apply the new locale.
 *
 * Fetches enabled locales from the public API.
 */
export function useLocaleCookie() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { enabledLocales, defaultLocale, isLoading: isLoadingConfig } = useLocaleConfigQuery();

  // Get enabled locale codes as Locale[]
  const enabledLocaleCodes = useMemo(
    () => enabledLocales.map((l) => l.code).filter(isValidLocale),
    [enabledLocales]
  );

  // Use the API default locale, falling back to static default
  const effectiveDefault = isValidLocale(defaultLocale) ? defaultLocale : DEFAULT_LOCALE;

  const [currentLocale, setCurrentLocale] = useState<Locale>(() =>
    getLocaleFromCookie(effectiveDefault)
  );

  // Validate current locale is still enabled
  const validatedLocale = useMemo(() => {
    if (enabledLocaleCodes.length === 0) return currentLocale;
    if (enabledLocaleCodes.includes(currentLocale)) return currentLocale;

    // If current locale is disabled, fall back to default
    return effectiveDefault;
  }, [currentLocale, enabledLocaleCodes, effectiveDefault]);

  /**
   * Change the locale
   *
   * Saves to cookie and refreshes the page to apply the new locale.
   */
  const changeLocale = useCallback(
    (locale: Locale) => {
      if (!isValidLocale(locale)) {
        return;
      }

      // Only allow changing to enabled locales
      if (enabledLocaleCodes.length > 0 && !enabledLocaleCodes.includes(locale)) {
        return;
      }

      setLocaleCookie(locale);
      setCurrentLocale(locale);

      // Refresh the page to apply the new locale
      startTransition(() => {
        router.refresh();
      });
    },
    [router, enabledLocaleCodes]
  );

  /**
   * Cycle through enabled locales
   */
  const cycleLocale = useCallback(() => {
    if (enabledLocaleCodes.length === 0) return;

    const currentIndex = enabledLocaleCodes.indexOf(validatedLocale);
    const nextIndex = (currentIndex + 1) % enabledLocaleCodes.length;

    changeLocale(enabledLocaleCodes[nextIndex]);
  }, [validatedLocale, enabledLocaleCodes, changeLocale]);

  return {
    /** Current locale from cookie (validated against enabled locales) */
    locale: validatedLocale,
    /** Change the locale */
    changeLocale,
    /** Cycle to next locale */
    cycleLocale,
    /** Whether locale change is in progress */
    isChanging: isPending,
    /** Whether locale config is still loading */
    isLoadingConfig,
    /** List of enabled locales */
    enabledLocales,
  };
}

export type UseLocaleCookieResult = ReturnType<typeof useLocaleCookie>;
