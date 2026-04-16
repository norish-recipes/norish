import { storage } from "@/lib/storage/mmkv";

import { getValidLocale, isValidLocale } from "@norish/i18n/config";

const LOCALE_PREFERENCE_KEY = "preferences.locale";

type LocaleFilePayload = {
  locale: string;
};

export function loadLocalePreference(): string | null {
  try {
    const content = storage.getString(LOCALE_PREFERENCE_KEY);

    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content) as Partial<LocaleFilePayload>;

    if (isValidLocale(parsed.locale)) {
      return parsed.locale;
    }

    return null;
  } catch {
    return null;
  }
}

export function saveLocalePreference(locale: string): void {
  const safeLocale = getValidLocale(locale);

  storage.set(LOCALE_PREFERENCE_KEY, JSON.stringify({ locale: safeLocale }));
}
