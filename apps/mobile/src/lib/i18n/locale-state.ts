import type { EnabledLocale } from "@norish/shared-react/config";
import { DEFAULT_LOCALE, getValidLocale, isValidLocale } from "@norish/i18n/config";

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

/** The enabled locale nearest a device language tag: an exact match, else the first of its language. */
export function matchDeviceLocale(
  deviceLocale: string,
  enabledLocales: EnabledLocale[]
): string | null {
  const codes = enabledLocales.map((locale) => locale.code);
  const exact = codes.find((code) => code.toLowerCase() === deviceLocale.toLowerCase());

  if (exact) return exact;

  const language = deviceLocale.split("-")[0]?.toLowerCase();
  // iOS names Norwegian Bokmål and Nynorsk `nb` and `nn`; the catalogue has one `no`.
  const base = language === "nb" || language === "nn" ? "no" : language;

  // German devices get the informal variant, not the catalogue's first German one.
  if (base === "de" && codes.includes("de-informal")) return "de-informal";

  return codes.find((code) => code.split("-")[0] === base) ?? null;
}

/** The app's iOS language (`AppleLanguages`, which the per-app language sets), else `fallback`. */
export function deviceLanguage(appleLanguages: unknown, fallback: string): string {
  const first: unknown = Array.isArray(appleLanguages) ? appleLanguages[0] : undefined;

  return typeof first === "string" ? first : fallback;
}
