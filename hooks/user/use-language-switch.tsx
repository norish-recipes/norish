"use client";

import { useEffect, useState } from "react";
import { GlobeAltIcon } from "@heroicons/react/16/solid";

import { useLocale } from "@/hooks/user/use-locale";
import { locales, localeNames, type Locale } from "@/i18n/config";

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

  const icon = <GlobeAltIcon className="size-4" />;

  const label = localeNames[currentLocale];

  return {
    mounted,
    icon,
    label,
    currentLocale,
    locales,
    localeNames,
    cycleLocale,
    selectLocale,
    isChanging,
  };
}

export type UseLanguageSwitchResult = ReturnType<typeof useLanguageSwitch>;
