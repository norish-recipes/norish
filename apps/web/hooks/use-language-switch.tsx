"use client";

import { useState } from "react";
import { useLocale } from "@/hooks/use-locale";
import { GlobeAltIcon } from "@heroicons/react/16/solid";

import type { Locale } from "@norish/i18n/config";
import { isValidLocale } from "@norish/i18n/config";
import { useLocaleConfigQuery } from "@norish/shared-react/config";

/** The language switch for signed-in readers: the choice is saved to their profile. */
export function useLanguageSwitch() {
  const { locale, changeLocale, isChanging } = useLocale();
  const { enabledLocales, isLoading: isLoadingConfig } = useLocaleConfigQuery();

  // Get enabled locale codes as Locale[]
  const enabledLocaleCodes = enabledLocales.map((l) => l.code).filter(isValidLocale);

  // Build locale names map from enabled locales
  const localeNames = Object.fromEntries(enabledLocales.map((l) => [l.code, l.name]));

  // Sync current locale index when locale or enabled locales change.
  // If current locale is not in enabled list, reset to first.
  const localeIndex =
    locale && enabledLocaleCodes.length > 0
      ? Math.max(enabledLocaleCodes.indexOf(locale), 0)
      : undefined;
  const [currentLocaleIndex, setCurrentLocaleIndex] = useState(localeIndex ?? 0);
  // The codes are compared by value: the list may be rebuilt on any render.
  const enabledKey = enabledLocaleCodes.join(",");
  const [syncedFrom, setSyncedFrom] = useState({ locale, enabledKey });

  if (locale !== syncedFrom.locale || enabledKey !== syncedFrom.enabledKey) {
    setSyncedFrom({ locale, enabledKey });

    if (localeIndex !== undefined) {
      setCurrentLocaleIndex(localeIndex);
    }
  }

  const currentLocale = enabledLocaleCodes[currentLocaleIndex] ?? locale ?? "en";

  const cycleLocale = () => {
    if (enabledLocaleCodes.length === 0) return;

    const nextIndex = (currentLocaleIndex + 1) % enabledLocaleCodes.length;
    const nextLocale = enabledLocaleCodes[nextIndex];

    if (!nextLocale) return;

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
  const label = localeNames[currentLocale] ?? currentLocale;

  return {
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
