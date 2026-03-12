import AsyncStorage from '@react-native-async-storage/async-storage';

import { getValidLocale, isValidLocale } from '@norish/i18n/config';

const LOCALE_PREFERENCE_KEY = 'preferences.locale';

type LocaleFilePayload = {
  locale: string;
};

export async function loadLocalePreference(): Promise<string | null> {
  try {
    const content = await AsyncStorage.getItem(LOCALE_PREFERENCE_KEY);

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

export async function saveLocalePreference(locale: string): Promise<void> {
  const safeLocale = getValidLocale(locale);

  await AsyncStorage.setItem(LOCALE_PREFERENCE_KEY, JSON.stringify({ locale: safeLocale }));
}
