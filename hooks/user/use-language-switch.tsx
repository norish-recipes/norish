"use client";

import { useEffect, useState, useMemo } from "react";
import { GlobeAltIcon } from "@heroicons/react/16/solid";

import { useLocale } from "@/hooks/user/use-locale";
import { useLocaleConfigQuery } from "@/hooks/config";
import { type Locale, isValidLocale, ALL_LOCALE_NAMES } from "@/i18n/config";

/**
 * Hook to get locale state and cycle function for language switching UI
 *
 * Used by authenticated users only - saves preference to database.
 * Fetches enabled locales from the API.
 */
export function useLanguageSwitch() {
  const { locale, changeLocale, isChanging } = useLocale();
  const { enabledLocales, isLoading: isLoadingConfig } = useLocaleConfigQuery();
  const [mounted, setMounted] = useState(false);
  const [currentLocaleIndex, setCurrentLocaleIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get enabled locale codes as Locale[]
  const enabledLocaleCodes = useMemo(
    () => enabledLocales.map((l) => l.code).filter(isValidLocale),
    [enabledLocales]
  );

  // Build locale names map from enabled locales
  const localeNames = useMemo(() => {
    const names: Record<string, string> = {};

    for (const l of enabledLocales) {
      names[l.code] = l.name;
    }

    return names;
  }, [enabledLocales]);

  // Sync current locale index when locale or enabled locales change
  useEffect(() => {
    if (locale && enabledLocaleCodes.length > 0) {
      const index = enabledLocaleCodes.indexOf(locale);

      if (index !== -1) {
        setCurrentLocaleIndex(index);
      } else {
        // If current locale is not in enabled list, reset to first
        setCurrentLocaleIndex(0);
      }
    }
  }, [locale, enabledLocaleCodes]);

  const currentLocale = enabledLocaleCodes[currentLocaleIndex] ?? locale ?? "en";

  const cycleLocale = () => {
    if (enabledLocaleCodes.length === 0) return;

    const nextIndex = (currentLocaleIndex + 1) % enabledLocaleCodes.length;
    const nextLocale = enabledLocaleCodes[nextIndex];

    setCurrentLocaleIndex(nextIndex);
    changeLocale(nextLocale);
  };

  const selectLocale = (newLocale: Locale) => {
    const index = enabledLocaleCodes.indexOf(newLocale);

    if (index !== -1) {
      setCurrentLocaleIndex(index);
      changeLocale(newLocale);
    }
  };

  const icon = <GlobeAltIcon className="size-4" />;

  // Use enabled locale name, fallback to static names
  const label =
    localeNames[currentLocale] ?? ALL_LOCALE_NAMES[currentLocale as Locale] ?? currentLocale;

  return {
    mounted,
    icon,
    label,
    currentLocale,
    /** Enabled locales only */
    locales: enabledLocaleCodes,
    localeNames,
    /** Full enabled locale objects */
    enabledLocales,
    cycleLocale,
    selectLocale,
    isChanging,
    isLoadingConfig,
  };
}

export type UseLanguageSwitchResult = ReturnType<typeof useLanguageSwitch>;
