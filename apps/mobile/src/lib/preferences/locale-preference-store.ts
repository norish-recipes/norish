import { storage } from "@/lib/storage/mmkv";

import type { Locale } from "@norish/i18n/config";
import { isValidLocale } from "@norish/i18n/config";

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

export function clearLocalePreference(): void {
  storage.remove(LOCALE_PREFERENCE_KEY);
}

export function saveLocalePreference(locale: Locale): void {
  storage.set(LOCALE_PREFERENCE_KEY, JSON.stringify({ locale }));
}
