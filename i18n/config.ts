/**
 * i18n Configuration
 *
 * Central configuration for internationalization.
 * To add a new language:
 * 1. Add the locale code to the `locales` array
 * 2. Add the display name in `localeNames`
 * 3. Create translation files in `i18n/messages/{locale}/`
 */

export const locales = ["en", "nl"] as const;
export const defaultLocale = "en" as const;

export type Locale = (typeof locales)[number];

/**
 * Human-readable display names for each locale
 */
export const localeNames: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
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
  nl: {
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
  nl: {
    maximumFractionDigits: 2,
  },
};
