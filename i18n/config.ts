/**
 * i18n Configuration
 *
 * Central configuration for internationalization.
 *
 * LOCALE CONFIGURATION:
 * Locale settings are stored in the server config database and can be managed via:
 * - Environment variables: DEFAULT_LOCALE, ENABLED_LOCALES
 * - Admin UI: Settings => Admin => General
 *
 * TO ADD A NEW LANGUAGE:
 * 1. Add the locale code and name to ALL_LOCALES below
 * 2. Create translation files in `i18n/messages/{locale}/`
 * 3. Update `server/startup/seed-config.ts` DEFAULT_LOCALE_CONFIG
 * 4. Update `config/server-config-loader.ts` DEFAULT_LOCALE_CONFIG
 *
 * The locale will be disabled by default until enabled via Admin UI or ENABLED_LOCALES env var.
 */

/**
 * All available locales in the system.
 * This is the static source of truth for what locales exist.
 * Enabled/disabled status is controlled via server config.
 */
export const ALL_LOCALES = ["en", "nl", "de-formal", "de-informal"] as const;

/**
 * Type for any valid locale code
 */
export type Locale = (typeof ALL_LOCALES)[number];

/**
 * Human-readable display names for each locale
 */
export const ALL_LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
  "de-formal": "Deutsch (Sie)",
  "de-informal": "Deutsch (Du)",
};

/**
 * Default locale used as ultimate fallback
 */
export const DEFAULT_LOCALE: Locale = "en";

/**
 * Check if a string is a valid locale code (exists in ALL_LOCALES)
 * Note: This checks if the locale exists, not if it's enabled.
 * For enabled check, use isValidEnabledLocale from server-config-loader.
 */
export function isValidLocale(locale: string): locale is Locale {
  return ALL_LOCALES.includes(locale as Locale);
}

/**
 * Get a valid locale from a string, falling back to default
 * Note: This validates against ALL locales, not just enabled ones.
 */
export function getValidLocale(locale: string | null | undefined): Locale {
  if (locale && isValidLocale(locale)) {
    return locale;
  }

  return DEFAULT_LOCALE;
}

/**
 * Default date/time format options
 * Used for consistent date formatting across the app
 * Same format for all locales (Intl.DateTimeFormat handles locale-specific rendering)
 */
export const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
};

/**
 * Default number format options
 * Same format for all locales (Intl.NumberFormat handles locale-specific rendering)
 */
export const DEFAULT_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 2,
};

/**
 * Get date format for a locale
 * Currently returns the same format for all locales
 */
export function getDateFormat(_locale: Locale): Intl.DateTimeFormatOptions {
  return DEFAULT_DATE_FORMAT;
}

/**
 * Get number format for a locale
 * Currently returns the same format for all locales
 */
export function getNumberFormat(_locale: Locale): Intl.NumberFormatOptions {
  return DEFAULT_NUMBER_FORMAT;
}

// ============================================================================
// Legacy exports for backward compatibility
// These will be removed in a future version
// ============================================================================

/**
 * @deprecated Use ALL_LOCALES instead
 */
export const locales = ALL_LOCALES;

/**
 * @deprecated Use DEFAULT_LOCALE instead
 */
export const defaultLocale = DEFAULT_LOCALE;

/**
 * @deprecated Use ALL_LOCALE_NAMES instead
 */
export const localeNames = ALL_LOCALE_NAMES;

/**
 * @deprecated Use getDateFormat() instead
 */
export const dateFormats: Record<Locale, Intl.DateTimeFormatOptions> = {
  en: DEFAULT_DATE_FORMAT,
  nl: DEFAULT_DATE_FORMAT,
  "de-formal": DEFAULT_DATE_FORMAT,
  "de-informal": DEFAULT_DATE_FORMAT,
};

/**
 * @deprecated Use getNumberFormat() instead
 */
export const numberFormats: Record<Locale, Intl.NumberFormatOptions> = {
  en: DEFAULT_NUMBER_FORMAT,
  nl: DEFAULT_NUMBER_FORMAT,
  "de-formal": DEFAULT_NUMBER_FORMAT,
  "de-informal": DEFAULT_NUMBER_FORMAT,
};
