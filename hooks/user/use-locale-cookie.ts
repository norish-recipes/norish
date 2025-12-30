"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { type Locale, isValidLocale, locales, defaultLocale } from "@/i18n/config";

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/**
 * Get locale from cookie (client-side)
 */
function getLocaleFromCookie(): Locale {
  if (typeof document === "undefined") {
    return defaultLocale;
  }

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === LOCALE_COOKIE_NAME && isValidLocale(value)) {
      return value;
    }
  }

  return defaultLocale;
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
 */
export function useLocaleCookie() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentLocale, setCurrentLocale] = useState<Locale>(getLocaleFromCookie);

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

      setLocaleCookie(locale);
      setCurrentLocale(locale);

      // Refresh the page to apply the new locale
      startTransition(() => {
        router.refresh();
      });
    },
    [router]
  );

  /**
   * Cycle through locales
   */
  const cycleLocale = useCallback(() => {
    const currentIndex = locales.indexOf(currentLocale);
    const nextIndex = (currentIndex + 1) % locales.length;
    changeLocale(locales[nextIndex]);
  }, [currentLocale, changeLocale]);

  return {
    /** Current locale from cookie */
    locale: currentLocale,
    /** Change the locale */
    changeLocale,
    /** Cycle to next locale */
    cycleLocale,
    /** Whether locale change is in progress */
    isChanging: isPending,
  };
}

export type UseLocaleCookieResult = ReturnType<typeof useLocaleCookie>;
