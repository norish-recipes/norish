/**
 * i18n Configuration - Client-side utilities
 *
 * This file provides type definitions and validation utilities for locales.
 * The actual locale configuration (enabled locales, names, etc.) is managed by
 * the server via `config/server-config-loader.ts` and stored in the database.
 *
 * TO ADD A NEW LANGUAGE:
 * 1. Create translation files in `i18n/messages/{locale}/`
 * 2. Add the locale entry to DEFAULT_LOCALE_CONFIG in `config/server-config-loader.ts`
 * 3. The locale will be available immediately (enabled by default)
 */

/**
 * Default locale used as ultimate fallback when no locale is set.
 * The actual default locale for the instance is configured in the database.
 */
export const DEFAULT_LOCALE = "en";

/**
 * Type for any valid locale code.
 * This is a loose string type since locales are now dynamically configured.
 */
export type Locale = string;

/**
 * Check if a string is a valid locale code format.
 * Note: This only checks format validity, not if the locale is enabled.
 * For enabled check, use isValidEnabledLocale from server-config-loader.
 */
export function isValidLocale(locale: unknown): locale is Locale {
  if (typeof locale !== "string") return false;

  // Basic format check: 2-3 letter language code, optionally with region/variant
  // Examples: en, nl, de-formal, de-informal, pt-BR
  return /^[a-z]{2,3}(-[a-zA-Z]{2,10})?$/.test(locale);
}

/**
 * Get a valid locale from a string, falling back to default.
 * Note: This validates format only, not if the locale is enabled.
 */
export function getValidLocale(locale: string | null | undefined): Locale {
  if (locale && isValidLocale(locale)) {
    return locale;
  }

  return DEFAULT_LOCALE;
}

/**
 * Default date/time format options.
 * Used for consistent date formatting across the app.
 * Intl.DateTimeFormat handles locale-specific rendering automatically.
 */
export const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
};

/**
 * Default number format options.
 * Intl.NumberFormat handles locale-specific rendering automatically.
 */
export const DEFAULT_NUMBER_FORMAT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 2,
};

/**
 * Get date format for a locale.
 * Currently returns the same format for all locales.
 */
export function getDateFormat(_locale: Locale): Intl.DateTimeFormatOptions {
  return DEFAULT_DATE_FORMAT;
}

/**
 * Get number format for a locale.
 * Currently returns the same format for all locales.
 */
export function getNumberFormat(_locale: Locale): Intl.NumberFormatOptions {
  return DEFAULT_NUMBER_FORMAT;
}
