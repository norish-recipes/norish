import { DEFAULT_LOCALE, isValidLocale } from "@norish/i18n/config";

import type { EnabledLocale, LocaleConfigResult } from "./types";

export function normalizeLocaleConfig(
  input: LocaleConfigResult | null | undefined
): LocaleConfigResult {
  const defaultLocale =
    typeof input?.defaultLocale === "string" && isValidLocale(input.defaultLocale)
      ? input.defaultLocale
      : DEFAULT_LOCALE;

  const enabledLocales = (input?.enabledLocales ?? []).filter(
    (locale): locale is EnabledLocale =>
      Boolean(locale) &&
      typeof locale.code === "string" &&
      typeof locale.name === "string" &&
      isValidLocale(locale.code)
  );

  return { defaultLocale, enabledLocales };
}
