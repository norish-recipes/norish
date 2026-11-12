import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform, Settings } from "react-native";
import {
  buildLocaleDisplayMap,
  deviceLanguage,
  matchDeviceLocale,
  resolveLocaleSelection,
} from "@/lib/i18n/locale-state";
import { publishLocale } from "@/lib/i18n/locale-store";
import {
  loadLocalePreference,
  saveLocalePreference,
} from "@/lib/preferences/locale-preference-store";
import { IntlProvider } from "react-intl";

import type { EnabledLocale } from "@norish/shared-react/config";
import { DEFAULT_LOCALE } from "@norish/i18n/config";
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
import { useLocaleSave } from "@norish/shared-react/reader";

type MobileLocaleContextValue = {
  locale: string;
  enabledLocales: EnabledLocale[];
  localeNames: Record<string, string>;
  isLoading: boolean;
  /** `fromServer` applies the server's own preference, so it is not written back. */
  setLocale: (nextLocale: string, options?: { fromServer?: boolean }) => void;
};

const MobileLocaleContext = createContext<MobileLocaleContextValue | null>(null);

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

export function MobileIntlProvider({
  children,
  signedIn,
}: {
  children: React.ReactNode;
  signedIn: boolean;
}) {
  // Read at first render, so a remount never opens on the default locale first.
  const [preferredLocale, setPreferredLocale] = useState(loadLocalePreference);
  const {
    enabledLocales: configuredLocales,
    defaultLocale: configuredDefaultLocale,
    isLoading: isConfigLoading,
  } = useLocaleConfigQuery();

  const saveLocale = useLocaleSave(signedIn);

  const localeOptions = useMemo(
    () => resolveLocaleOptions(BUNDLED_LOCALES, configuredLocales),
    [configuredLocales]
  );
  const effectiveDefaultLocale = useMemo(() => {
    const bundledCodes = new Set(localeOptions.map((locale) => locale.code));

    return bundledCodes.has(configuredDefaultLocale) ? configuredDefaultLocale : DEFAULT_LOCALE;
  }, [configuredDefaultLocale, localeOptions]);

  // Signed out, the screens follow the device language.
  const activeLocale = resolveLocaleSelection(
    signedIn ? preferredLocale : matchDeviceLocale(DEVICE_LOCALE, localeOptions),
    localeOptions,
    effectiveDefaultLocale
  );

  const localeNames = useMemo(() => buildLocaleDisplayMap(localeOptions), [localeOptions]);

  const { messages, isLoading: isMessagesLoading } = useLocaleMessages(activeLocale);

  const value = useMemo<MobileLocaleContextValue>(
    () => ({
      locale: activeLocale,
      enabledLocales: localeOptions,
      localeNames,
      // The server's enabled locales can still change the language until they load.
      isLoading: isMessagesLoading || isConfigLoading,
      setLocale: (nextLocale, options) => {
        const nextResolved = resolveLocaleSelection(
          nextLocale,
          localeOptions,
          effectiveDefaultLocale
        );

        if (nextResolved === activeLocale) {
          return;
        }

        // Publish synchronously so useSyncExternalStore subscribers (e.g.
        // SettingsMenu inside a native SwiftUI Host) re-render on the same
        // tick — before the async React state update settles.
        publishLocale(nextResolved);

        setPreferredLocale(nextResolved);
        void saveLocalePreference(nextResolved);

        if (signedIn && !options?.fromServer) {
          saveLocale(nextResolved);
        }
      },
    }),
    [
      activeLocale,
      effectiveDefaultLocale,
      signedIn,
      isMessagesLoading,
      isConfigLoading,
      localeNames,
      localeOptions,
      saveLocale,
    ]
  );

  // Keep the synchronous store in sync for initial load and backend-driven
  // changes (e.g. server-side locale preference applied on sign-in).
  useEffect(() => {
    publishLocale(activeLocale);
  }, [activeLocale]);

  return (
    <MobileLocaleContext.Provider value={value}>
      <IntlProvider
        defaultLocale={DEFAULT_LOCALE}
        locale={activeLocale}
        messages={flattenMessages(messages)}
      >
        {children}
      </IntlProvider>
    </MobileLocaleContext.Provider>
  );
}

export function MobileIntlFallbackProvider({ children }: { children: React.ReactNode }) {
  const [preferredLocale, setPreferredLocale] = useState<string | null>(null);
  const localeOptions = BUNDLED_LOCALES;
  const localeNames = useMemo(() => buildLocaleDisplayMap(localeOptions), [localeOptions]);
  const activeLocale = resolveLocaleSelection(
    preferredLocale ?? matchDeviceLocale(DEVICE_LOCALE, localeOptions),
    localeOptions,
    DEFAULT_LOCALE
  );

  const { messages, isLoading: isLoadingMessages } = useLocaleMessages(activeLocale);

  useEffect(() => {
    publishLocale(activeLocale);
  }, [activeLocale]);

  const fallback = useMemo<MobileLocaleContextValue>(
    () => ({
      locale: activeLocale,
      enabledLocales: localeOptions,
      localeNames,
      isLoading: isLoadingMessages,
      setLocale: (nextLocale: string) => {
        const nextResolved = resolveLocaleSelection(nextLocale, localeOptions, DEFAULT_LOCALE);

        publishLocale(nextResolved);
        setPreferredLocale(nextResolved);
        void saveLocalePreference(nextResolved);
      },
    }),
    [activeLocale, isLoadingMessages, localeNames, localeOptions]
  );

  return (
    <MobileLocaleContext.Provider value={fallback}>
      <IntlProvider
        defaultLocale={DEFAULT_LOCALE}
        locale={activeLocale}
        messages={flattenMessages(messages)}
      >
        {children}
      </IntlProvider>
    </MobileLocaleContext.Provider>
  );
}

export function useMobileLocaleSettings() {
  const context = useContext(MobileLocaleContext);

  if (!context) {
    throw new Error("useMobileLocaleSettings must be used inside MobileIntlProvider");
  }

  return context;
}
