import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

import { defaultLocale, isValidLocale, LOCALE_COOKIE_NAME, type Locale } from "./config";

import { auth } from "@/server/auth/auth";
import { getUserLocale } from "@/server/db/repositories/users";

/**
 * Resolve the locale for the current request
 *
 * Priority:
 * 1. User's saved preference (if authenticated)
 * 2. Cookie value (if set)
 * 3. Accept-Language header
 * 4. Default locale (en)
 */
async function resolveLocale(): Promise<Locale> {
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
    // Auth check failed, continue to cookie/header detection
  }

  // 2. Check cookie
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (localeCookie && isValidLocale(localeCookie)) {
    return localeCookie;
  }

  // 3. Check Accept-Language header
  const headersList = await headers();
  const acceptLanguage = headersList.get("Accept-Language");
  if (acceptLanguage) {
    // Parse Accept-Language header (e.g., "en-US,en;q=0.9,de;q=0.8")
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const [code, q] = lang.trim().split(";q=");
        return {
          code: code.split("-")[0].toLowerCase(), // Get base language code
          quality: q ? parseFloat(q) : 1,
        };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const { code } of languages) {
      if (isValidLocale(code)) {
        return code;
      }
    }
  }

  // 4. Fallback to default
  return defaultLocale;
}

/**
 * Load messages for a specific locale
 */
async function loadMessages(locale: Locale) {
  // Import all namespace files for the locale
  const [common, navbar, auth, recipes, groceries, calendar, settings, admin] = await Promise.all([
    import(`@/i18n/translations/${locale}/common.json`).then((m) => m.default),
    import(`@/i18n/translations/${locale}/navbar.json`).then((m) => m.default),
    import(`@/i18n/translations/${locale}/auth.json`).then((m) => m.default),
    import(`@/i18n/translations/${locale}/recipes.json`).then((m) => m.default),
    import(`@/i18n/translations/${locale}/groceries.json`).then((m) => m.default),
    import(`@/i18n/translations/${locale}/calendar.json`).then((m) => m.default),
    import(`@/i18n/translations/${locale}/settings.json`).then((m) => m.default),
    import(`@/i18n/translations/${locale}/admin.json`).then((m) => m.default),
  ]);

  return {
    common,
    navbar,
    auth,
    recipes,
    groceries,
    calendar,
    settings,
    admin,
  };
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
    // Configure date/time/number formatting
    timeZone: "UTC", // Will be overridden by user's timezone if needed
    now: new Date(),
    formats: {
      dateTime: {
        short: {
          day: "numeric",
          month: "short",
          year: "numeric",
        },
        long: {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
        },
      },
      number: {
        precise: {
          maximumFractionDigits: 2,
        },
      },
    },
  };
});
