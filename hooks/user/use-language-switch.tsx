"use client";

import { FC, useEffect, useState } from "react";
import { GlobeAltIcon } from "@heroicons/react/16/solid";

import { useLocale } from "@/hooks/user/use-locale";
import { locales, localeNames, localeToCountry, type Locale } from "@/i18n/config";

// Dynamically import flag icons to avoid SSR issues
let FlagComponents: Record<string, FC<{ title: string; className?: string }>> = {};

/**
 * Hook to get locale state and cycle function for language switching UI
 *
 * Used by authenticated users only - saves preference to database.
 */
export function useLanguageSwitch() {
  const { locale, changeLocale, isChanging } = useLocale();
  const [mounted, setMounted] = useState(false);
  const [currentLocaleIndex, setCurrentLocaleIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
    // Dynamically import flags
    import("country-flag-icons/react/3x2").then((flags) => {
      FlagComponents = flags as unknown as Record<
        string,
        FC<{ title: string; className?: string }>
      >;
    });
  }, []);

  // Sync current locale index when locale changes
  useEffect(() => {
    if (locale) {
      const index = locales.indexOf(locale);
      if (index !== -1) {
        setCurrentLocaleIndex(index);
      }
    }
  }, [locale]);

  const currentLocale = locales[currentLocaleIndex];
  const countryCode = localeToCountry[currentLocale];
  const FlagIcon = FlagComponents[countryCode];

  const cycleLocale = () => {
    const nextIndex = (currentLocaleIndex + 1) % locales.length;
    const nextLocale = locales[nextIndex];
    setCurrentLocaleIndex(nextIndex);
    changeLocale(nextLocale);
  };

  const selectLocale = (newLocale: Locale) => {
    const index = locales.indexOf(newLocale);
    if (index !== -1) {
      setCurrentLocaleIndex(index);
      changeLocale(newLocale);
    }
  };

  const icon = FlagIcon ? (
    <FlagIcon className="h-3 w-4 rounded-sm" title={localeNames[currentLocale]} />
  ) : (
    <GlobeAltIcon className="size-4" />
  );

  const label = localeNames[currentLocale];

  return {
    mounted,
    icon,
    label,
    currentLocale,
    locales,
    localeNames,
    localeToCountry,
    cycleLocale,
    selectLocale,
    isChanging,
  };
}

export type UseLanguageSwitchResult = ReturnType<typeof useLanguageSwitch>;
