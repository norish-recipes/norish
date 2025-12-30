import "server-only";

import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

import { isValidLocale, type Locale } from "./config";

import { auth } from "@/server/auth/auth";
import { getUserLocale } from "@/server/db/repositories/users";
import { SERVER_CONFIG } from "@/config/env-config-server";

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/**
 * Get the validated default locale from server config
 * Falls back to 'en' if configured locale is not valid
 */
function getDefaultLocale(): Locale {
  const configuredLocale = SERVER_CONFIG.DEFAULT_LOCALE;

  if (isValidLocale(configuredLocale)) {
    return configuredLocale;
  }

  return "en";
}

/**
 * Resolve the locale for the current request
 *
 * Priority:
 * 1. User's saved preference (if authenticated)
 * 2. Cookie preference (for unauthenticated users)
 * 3. Instance default locale (DEFAULT_LOCALE env var, validated)
 */
async function resolveLocale(): Promise<Locale> {
  const defaultLocale = getDefaultLocale();

  // 1. Check if user is authenticated and has a locale preference
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user?.id) {
      const userLocale = await getUserLocale(session.user.id);

      if (userLocale && isValidLocale(userLocale)) {
        return userLocale;
      }
    }
  } catch {
    // Auth check failed, fall through to cookie check
  }

  // 2. Check for locale cookie (for unauthenticated users)
  try {
    const cookieStore = await cookies();
    const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME);

    if (localeCookie?.value && isValidLocale(localeCookie.value)) {
      return localeCookie.value;
    }
  } catch {
    // Cookie check failed, fall through to default
  }

  // 3. Fall back to instance default
  return defaultLocale;
}

/**
 * Load and merge all translation files for a locale
 * Files are organized by section: common, recipes, groceries, calendar, settings, navbar, auth
 */
async function loadMessages(locale: Locale): Promise<Record<string, unknown>> {
  const sections = [
    "common",
    "recipes",
    "groceries",
    "calendar",
    "settings",
    "navbar",
    "auth",
  ] as const;

  const messages: Record<string, unknown> = {};

  for (const section of sections) {
    try {
      const sectionMessages = (await import(`./messages/${locale}/${section}.json`)).default;
      messages[section] = sectionMessages;
    } catch {
      // Section file doesn't exist for this locale, skip
    }
  }

  return messages;
}

/**
 * Request configuration for next-intl
 * This is called on every request to determine locale and load messages
 */
export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = await loadMessages(locale);

  return {
    locale,
    messages,
  };
});
