import { defineRouting } from "next-intl/routing";

import { locales, defaultLocale } from "./config";

/**
 * Routing configuration for next-intl
 *
 * Using localePrefix: 'never' means:
 * - URLs stay clean (no /en/ prefix)
 * - Locale is determined by user preference or cookie
 * - Falls back to browser Accept-Language header
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "never",
  // Disable automatic locale detection from Accept-Language
  // We handle this ourselves based on user preferences
  localeDetection: false,
});
