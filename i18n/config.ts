/**
 * i18n Configuration
 *
 * Central configuration for internationalization.
 * To add a new language:
 * 1. Add the locale code to the `locales` array
 * 2. Add the country code mapping in `localeToCountry`
 * 3. Add the display name in `localeNames`
 * 4. Create translation files in `messages/{locale}/`
 */

export const locales = ["en"] as const;
export const defaultLocale = "en" as const;

export type Locale = (typeof locales)[number];

/**
 * Cookie name for storing locale preference
 * Used for unauthenticated users
 */
export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/**
 * Map locale to ISO 3166-1 alpha-2 country code for flag icons
 * Used by country-flag-icons package
 */
export const localeToCountry: Record<Locale, string> = {
  en: "GB",
};

/**
 * Human-readable display names for each locale
 */
export const localeNames: Record<Locale, string> = {
  en: "English",
};

/**
 * Check if a string is a valid locale
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

/**
 * Get a valid locale from a string, falling back to default
 */
export function getValidLocale(locale: string | null | undefined): Locale {
  if (locale && isValidLocale(locale)) {
    return locale;
  }
  return defaultLocale;
}

/**
 * Date/time format options per locale
 * Used for consistent date formatting across the app
 */
export const dateFormats: Record<Locale, Intl.DateTimeFormatOptions> = {
  en: {
    dateStyle: "medium",
  },
};

/**
 * Number format options per locale
 */
export const numberFormats: Record<Locale, Intl.NumberFormatOptions> = {
  en: {
    maximumFractionDigits: 2,
  },
};
