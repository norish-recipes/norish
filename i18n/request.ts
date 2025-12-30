import "server-only";

import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";

import { isValidLocale, type Locale } from "./config";

import { auth } from "@/server/auth/auth";
import { getUserLocale } from "@/server/db/repositories/users";
import { SERVER_CONFIG } from "@/config/env-config-server";

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
 * 2. Instance default locale (DEFAULT_LOCALE env var, validated)
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
    // Auth check failed, fall through to default
  }

  // 2. Fall back to instance default
  return defaultLocale;
}

/**
 * Request configuration for next-intl
 * This is called on every request to determine locale and load messages
 */
export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    // Empty messages for now - translations will be added in a future phase
    messages: {},
  };
});
