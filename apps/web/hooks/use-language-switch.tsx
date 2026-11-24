"use client";

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

  // The saved language, optimistic while a save is in flight; one not enabled reads as the first.
  const currentLocaleIndex = locale ? Math.max(enabledLocaleCodes.indexOf(locale), 0) : 0;
  const currentLocale = enabledLocaleCodes[currentLocaleIndex] ?? locale ?? "en";

  const cycleLocale = () => {
    const nextLocale = enabledLocaleCodes[(currentLocaleIndex + 1) % enabledLocaleCodes.length];

    if (nextLocale) void changeLocale(nextLocale);
  };

  const selectLocale = (newLocale: Locale) => {
    if (enabledLocaleCodes.includes(newLocale)) void changeLocale(newLocale);
  };

  const icon = <GlobeAltIcon className="size-5" />;

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
