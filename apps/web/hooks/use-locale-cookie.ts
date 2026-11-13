"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Locale } from "@norish/i18n/config";
import { DEFAULT_LOCALE, isValidLocale } from "@norish/i18n/config";
import { useLocaleConfigQuery } from "@norish/shared-react/config";

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

/** The locale for signed-out pages, kept in a cookie; enabled locales come from the public API. */
export function useLocaleCookie() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { enabledLocales, defaultLocale, isLoading: isLoadingConfig } = useLocaleConfigQuery();

  // Get enabled locale codes as Locale[]
  const enabledLocaleCodes = enabledLocales.map((l) => l.code).filter(isValidLocale);

  // Use the API default locale, falling back to static default
  const effectiveDefault = isValidLocale(defaultLocale) ? defaultLocale : DEFAULT_LOCALE;

  const [currentLocale, setCurrentLocale] = useState<Locale>(() =>
    getLocaleFromCookie(effectiveDefault)
  );

  // A locale that is no longer enabled falls back to the default.
  const validatedLocale =
    enabledLocaleCodes.length === 0 || enabledLocaleCodes.includes(currentLocale)
      ? currentLocale
      : effectiveDefault;

  /** Saves the cookie and refreshes the page to apply the new locale. */
  const changeLocale = (locale: Locale) => {
    if (!isValidLocale(locale)) {
      return;
    }

    // Only allow changing to enabled locales
    if (enabledLocaleCodes.length > 0 && !enabledLocaleCodes.includes(locale)) {
      return;
    }

    setLocaleCookie(locale);
    setCurrentLocale(locale);

    startTransition(() => {
      router.refresh();
    });
  };

  const cycleLocale = () => {
    if (enabledLocaleCodes.length === 0) return;

    const currentIndex = enabledLocaleCodes.indexOf(validatedLocale);
    const nextIndex = (currentIndex + 1) % enabledLocaleCodes.length;
    const nextLocale = enabledLocaleCodes[nextIndex];

    if (nextLocale) changeLocale(nextLocale);
  };

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
