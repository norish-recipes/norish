import "server-only";

import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

import { isValidLocale, type Locale, DEFAULT_LOCALE } from "./config";

import { auth } from "@/server/auth/auth";
import { getUserLocale } from "@/server/db/repositories/users";
import {
  getDefaultLocale as getConfigDefaultLocale,
  isValidEnabledLocale,
} from "@/config/server-config-loader";

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/**
 * Resolve the locale for the current request
 *
 * Priority:
 * 1. User's saved preference (if authenticated and locale is enabled)
 * 2. Cookie preference (for unauthenticated users, if locale is enabled)
 * 3. Instance default locale from server config
 *
 * Note: Locales must be ENABLED (not just valid) to be used.
 * If a user has a saved locale that was later disabled, they fall back to default.
 */
async function resolveLocale(): Promise<Locale> {
  // Get default from server config (DB > env > fallback)
  const configDefaultLocale = await getConfigDefaultLocale();
  const defaultLocale = isValidLocale(configDefaultLocale) ? configDefaultLocale : DEFAULT_LOCALE;

  // 1. Check if user is authenticated and has a locale preference
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user?.id) {
      const userLocale = await getUserLocale(session.user.id);

      // User's locale must be valid AND enabled
      if (userLocale && isValidLocale(userLocale) && (await isValidEnabledLocale(userLocale))) {
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

    // Cookie locale must be valid AND enabled
    if (
      localeCookie?.value &&
      isValidLocale(localeCookie.value) &&
      (await isValidEnabledLocale(localeCookie.value))
    ) {
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
