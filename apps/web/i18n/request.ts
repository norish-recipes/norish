import "server-only";

import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import type { Locale } from "@norish/i18n";
import { auth } from "@norish/auth/auth";
import {
  getDefaultLocale as getConfigDefaultLocale,
  isValidEnabledLocale,
} from "@norish/config/server-config-loader";
import { getUserPreferences } from "@norish/db/repositories/users";
import { DEFAULT_LOCALE, isValidLocale, loadLocaleMessages } from "@norish/i18n";

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
      const prefs = await getUserPreferences(session.user.id);
      const userLocale = typeof prefs.locale === "string" ? prefs.locale : null;

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
 * Request configuration for next-intl
 * This is called on every request to determine locale and load messages
 */
export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const messages = await loadLocaleMessages(locale);

  return {
    locale,
    messages,
  };
});
