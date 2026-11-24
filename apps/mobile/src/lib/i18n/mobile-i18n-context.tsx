import React, { createContext, use, useEffect, useState } from "react";
import { Platform, Settings } from "react-native";
import {
  deviceLanguage,
  isOffered,
  matchDeviceLocale,
  resolveLocaleSelection,
} from "@/lib/i18n/locale-state";
import {
  clearLocalePreference,
  loadLocalePreference,
  saveLocalePreference,
} from "@/lib/preferences/locale-preference-store";
import { IntlProvider } from "react-intl";

import type { EnabledLocale } from "@norish/shared-react/config";
import { DEFAULT_LOCALE, isValidLocale } from "@norish/i18n/config";
import { getBundledLocales } from "@norish/i18n/locales";
import { loadLocaleMessages } from "@norish/i18n/messages";
import enAuthMessages from "@norish/i18n/messages/en/auth.json";
import enCalendarMessages from "@norish/i18n/messages/en/calendar.json";
import enCommonMessages from "@norish/i18n/messages/en/common.json";
import enGroceriesMessages from "@norish/i18n/messages/en/groceries.json";
import enNavbarMessages from "@norish/i18n/messages/en/navbar.json";
import enRecipesMessages from "@norish/i18n/messages/en/recipes.json";
import enSettingsMessages from "@norish/i18n/messages/en/settings.json";
import { useLocaleConfigQuery } from "@norish/shared-react/config";
import { useSavedLocale } from "@norish/shared-react/reader";

export type MobileLocaleContextValue = {
  locale: string;
  /** The languages the reader can pick. */
  options: EnabledLocale[];
  isLoading: boolean;
  /** Signed in, `LocaleSaveScope` saves it to the profile, whose saved language is shown. */
  setLocale: (nextLocale: string) => void;
};

export const MobileLocaleContext = createContext<MobileLocaleContextValue | null>(null);

const FALLBACK_MESSAGES: Record<string, unknown> = {
  auth: enAuthMessages,
  calendar: enCalendarMessages,
  common: enCommonMessages,
  groceries: enGroceriesMessages,
  navbar: enNavbarMessages,
  recipes: enRecipesMessages,
  settings: enSettingsMessages,
};

const BUNDLED_LOCALES: EnabledLocale[] = getBundledLocales();

// Module scope, so a provider remounted by the session's re-key opens on the loaded messages.
const loadedMessages = new Map<string, Record<string, unknown>>([
  [DEFAULT_LOCALE, FALLBACK_MESSAGES],
]);

/** `locale`'s messages, the last loaded ones until they arrive; `isLoading` until then. */
function useLocaleMessages(locale: string) {
  const [lastLoaded, setLastLoaded] = useState(
    () => loadedMessages.get(locale) ?? FALLBACK_MESSAGES
  );
  const loaded = loadedMessages.get(locale);

  useEffect(() => {
    if (loadedMessages.has(locale)) return;

    let isMounted = true;

    void loadLocaleMessages(locale).then((messages) => {
      const usable = Object.keys(messages).length > 0 ? messages : FALLBACK_MESSAGES;

      loadedMessages.set(locale, usable);
      if (isMounted) setLastLoaded(usable);
    });

    return () => {
      isMounted = false;
    };
  }, [locale]);

  return { messages: loaded ?? lastLoaded, isLoading: loaded === undefined };
}

// Intl ignores the per-app language; AppleLanguages follows it, and iOS relaunches on a change.
const DEVICE_LOCALE = deviceLanguage(
  Platform.OS === "ios" ? Settings.get("AppleLanguages") : undefined,
  Intl.DateTimeFormat().resolvedOptions().locale
);

function resolveLocaleOptions(
  bundledLocales: EnabledLocale[],
  configuredLocales: EnabledLocale[]
): EnabledLocale[] {
  if (configuredLocales.length === 0) {
    return bundledLocales;
  }

  const bundledLocaleMap = new Map(bundledLocales.map((locale) => [locale.code, locale]));
  const resolvedLocales = configuredLocales
    .map((locale) => bundledLocaleMap.get(locale.code))
    .filter((locale): locale is EnabledLocale => Boolean(locale));

  return resolvedLocales.length > 0 ? resolvedLocales : bundledLocales;
}

function flattenMessages(messages: Record<string, unknown>, prefix = ""): Record<string, string> {
  const flatMessages: Record<string, string> = {};

  for (const [key, value] of Object.entries(messages)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      flatMessages[nextKey] = value;
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(flatMessages, flattenMessages(value as Record<string, unknown>, nextKey));
    }
  }

  return flatMessages;
}

function LocaleScope({
  value,
  messages,
  children,
}: {
  value: MobileLocaleContextValue;
  messages: Record<string, unknown>;
  children: React.ReactNode;
}) {
  return (
    <MobileLocaleContext value={value}>
      <IntlProvider
        defaultLocale={DEFAULT_LOCALE}
        locale={value.locale}
        messages={flattenMessages(messages)}
      >
        {children}
      </IntlProvider>
    </MobileLocaleContext>
  );
}

export function MobileIntlProvider({
  children,
  signedIn,
}: {
  children: React.ReactNode;
  signedIn: boolean;
}) {
  // Read at first render, so a remount never opens on the default locale first.
  const [preferredLocale, setPreferredLocale] = useState(loadLocalePreference);
  const savedLocale = useSavedLocale();
  const {
    enabledLocales: configuredLocales,
    defaultLocale: configuredDefaultLocale,
    isLoading: isConfigLoading,
  } = useLocaleConfigQuery();

  const localeOptions = resolveLocaleOptions(BUNDLED_LOCALES, configuredLocales);
  const effectiveDefaultLocale = isOffered(localeOptions, configuredDefaultLocale)
    ? configuredDefaultLocale
    : DEFAULT_LOCALE;

  // Signed in, the profile's saved language, else the device's own; signed out, the device language.
  const activeLocale = resolveLocaleSelection(
    signedIn ? (savedLocale ?? preferredLocale) : matchDeviceLocale(DEVICE_LOCALE, localeOptions),
    localeOptions,
    effectiveDefaultLocale
  );

  useEffect(() => {
    if (!signedIn) return;

    const choice = savedLocale ?? preferredLocale;

    if (isValidLocale(choice)) saveLocalePreference(choice);
    else clearLocalePreference();
  }, [signedIn, savedLocale, preferredLocale]);

  const { messages, isLoading: isMessagesLoading } = useLocaleMessages(activeLocale);

  const value: MobileLocaleContextValue = {
    locale: activeLocale,
    options: localeOptions,
    // The server's enabled locales can still change the language until they load.
    isLoading: isMessagesLoading || isConfigLoading,
    setLocale: (nextLocale) => {
      if (isOffered(localeOptions, nextLocale)) setPreferredLocale(nextLocale);
    },
  };

  return (
    <LocaleScope messages={messages} value={value}>
      {children}
    </LocaleScope>
  );
}

export function MobileIntlFallbackProvider({ children }: { children: React.ReactNode }) {
  const [preferredLocale, setPreferredLocale] = useState<string | null>(null);
  const activeLocale = resolveLocaleSelection(
    preferredLocale ?? matchDeviceLocale(DEVICE_LOCALE, BUNDLED_LOCALES),
    BUNDLED_LOCALES,
    DEFAULT_LOCALE
  );

  const { messages, isLoading } = useLocaleMessages(activeLocale);

  const value: MobileLocaleContextValue = {
    locale: activeLocale,
    options: BUNDLED_LOCALES,
    isLoading,
    setLocale: (nextLocale: string) => {
      if (!isOffered(BUNDLED_LOCALES, nextLocale)) return;

      setPreferredLocale(nextLocale);
      saveLocalePreference(nextLocale);
    },
  };

  return (
    <LocaleScope messages={messages} value={value}>
      {children}
    </LocaleScope>
  );
}

export function useMobileLocaleSettings() {
  const context = use(MobileLocaleContext);

  if (!context) {
    throw new Error("useMobileLocaleSettings must be used inside MobileIntlProvider");
  }

  return context;
}
