import type { EnabledLocale } from "@norish/shared-react/hooks";
import { DEFAULT_LOCALE, getValidLocale, isValidLocale } from "@norish/i18n/config";

type LocaleDisplayMap = Record<string, string>;

function getLocaleDisplayName(localeCode: string): string {
  try {
    const baseLanguage = localeCode.split("-")[0] ?? localeCode;
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    const resolved = displayNames.of(baseLanguage);

    return resolved || localeCode;
  } catch {
    return localeCode;
  }
}

export function normalizeEnabledLocales(
  locales: EnabledLocale[],
  defaultLocale: string
): EnabledLocale[] {
  const byCode = new Map<string, EnabledLocale>();

  for (const locale of locales) {
    if (!isValidLocale(locale.code)) {
      continue;
    }

    byCode.set(locale.code, locale);
  }

  if (byCode.size > 0) {
    return Array.from(byCode.values());
  }

  const fallbackCode = getValidLocale(defaultLocale);

  return [{ code: fallbackCode, name: getLocaleDisplayName(fallbackCode) }];
}

export function resolveLocaleSelection(
  requestedLocale: string | null,
  enabledLocales: EnabledLocale[],
  defaultLocale: string
): string {
  const normalizedDefault = getValidLocale(defaultLocale);
  const enabledCodes = new Set(enabledLocales.map((locale) => locale.code));

  if (requestedLocale && enabledCodes.has(requestedLocale)) {
    return requestedLocale;
  }

  if (enabledCodes.has(normalizedDefault)) {
    return normalizedDefault;
  }

  return enabledLocales[0]?.code ?? DEFAULT_LOCALE;
}

export function buildLocaleDisplayMap(locales: EnabledLocale[]): LocaleDisplayMap {
  const displayMap: LocaleDisplayMap = {};

  for (const locale of locales) {
    displayMap[locale.code] = locale.name || getLocaleDisplayName(locale.code);
  }

  return displayMap;
}
