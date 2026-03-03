import { DEFAULT_LOCALE } from '@norish/i18n/config';
import { loadLocaleMessages } from '@norish/i18n/messages';
import type { User } from '@norish/shared/contracts';
import { getLocalePreference } from '@norish/shared/lib/user-preferences';
import type { EnabledLocale } from '@norish/shared-react/hooks';
import { useMutation, useQuery } from '@tanstack/react-query';
import { IntlProvider } from 'react-intl';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/context/auth-context';
import { useLocaleConfigQuery } from '@/hooks/config';
import {
  buildLocaleDisplayMap,
  normalizeEnabledLocales,
  resolveLocaleSelection,
} from '@/lib/i18n/locale-state';
import { publishLocale } from '@/lib/i18n/locale-store';
import {
  loadLocalePreference,
  saveLocalePreference,
} from '@/lib/preferences/locale-preference-store';
import { useTRPC } from '@/providers/trpc-provider';

type MobileLocaleContextValue = {
  locale: string;
  enabledLocales: EnabledLocale[];
  localeNames: Record<string, string>;
  isLoading: boolean;
  setLocale: (nextLocale: string) => void;
};

const MobileLocaleContext = createContext<MobileLocaleContextValue | null>(null);

function flattenMessages(messages: Record<string, unknown>, prefix = ''): Record<string, string> {
  const flatMessages: Record<string, string> = {};

  for (const [key, value] of Object.entries(messages)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      flatMessages[nextKey] = value;
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flatMessages, flattenMessages(value as Record<string, unknown>, nextKey));
    }
  }

  return flatMessages;
}

function MobileLocaleProviderInner({ children }: { children: React.ReactNode }) {
  const trpc = useTRPC();
  const { isAuthenticated } = useAuth();
  const { enabledLocales, defaultLocale, isLoading } = useLocaleConfigQuery();
  const [preferredLocale, setPreferredLocale] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, unknown>>({});
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  const pendingServerLocaleRef = useRef<string | null>(null);

  const userSettingsQuery = useQuery(
    trpc.user.get.queryOptions(undefined, {
      enabled: isAuthenticated,
      staleTime: 60_000,
    })
  );

  const updatePreferencesMutation = useMutation(trpc.user.updatePreferences.mutationOptions());

  const backendPreferredLocale = useMemo(() => {
    const settings = userSettingsQuery.data as { user?: Pick<User, 'preferences'> } | undefined;

    return getLocalePreference(settings?.user ?? null);
  }, [userSettingsQuery.data]);

  const localeOptions = useMemo(
    () => normalizeEnabledLocales(enabledLocales, defaultLocale),
    [defaultLocale, enabledLocales]
  );

  const activeLocale = useMemo(
    () => resolveLocaleSelection(preferredLocale, localeOptions, defaultLocale),
    [defaultLocale, localeOptions, preferredLocale]
  );

  const localeNames = useMemo(() => buildLocaleDisplayMap(localeOptions), [localeOptions]);

  useEffect(() => {
    let isMounted = true;

    const hydratePreference = async () => {
      const storedLocale = await loadLocalePreference();

      if (!isMounted) {
        return;
      }

      setPreferredLocale(storedLocale);
    };

    void hydratePreference();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!backendPreferredLocale) {
      return;
    }

    const resolved = resolveLocaleSelection(backendPreferredLocale, localeOptions, defaultLocale);

    if (pendingServerLocaleRef.current && pendingServerLocaleRef.current !== resolved) {
      return;
    }

    if (pendingServerLocaleRef.current === resolved) {
      pendingServerLocaleRef.current = null;
    }

    setPreferredLocale((currentPreferredLocale) => {
      if (currentPreferredLocale === resolved) {
        return currentPreferredLocale;
      }

      void saveLocalePreference(resolved);
      return resolved;
    });
  }, [backendPreferredLocale, defaultLocale, localeOptions]);

  useEffect(() => {
    let isMounted = true;

    const loadMessages = async () => {
      setIsMessagesLoading(true);

      const loaded = await loadLocaleMessages(activeLocale);

      if (!isMounted) {
        return;
      }

      setMessages(loaded);
      setIsMessagesLoading(false);
    };

    void loadMessages();

    return () => {
      isMounted = false;
    };
  }, [activeLocale]);

  const value = useMemo<MobileLocaleContextValue>(
    () => ({
      locale: activeLocale,
      enabledLocales: localeOptions,
      localeNames,
      isLoading: isLoading || isMessagesLoading || (isAuthenticated && userSettingsQuery.isLoading),
      setLocale: (nextLocale: string) => {
        const nextResolved = resolveLocaleSelection(nextLocale, localeOptions, defaultLocale);

        if (nextResolved === activeLocale) {
          return;
        }

        // Publish synchronously so useSyncExternalStore subscribers (e.g.
        // SettingsMenu inside a native SwiftUI Host) re-render on the same
        // tick — before the async React state update settles.
        publishLocale(nextResolved);
        pendingServerLocaleRef.current = nextResolved;

        setPreferredLocale(nextResolved);
        void saveLocalePreference(nextResolved);

        if (isAuthenticated) {
          void updatePreferencesMutation
            .mutateAsync({
              preferences: {
                locale: nextResolved,
              },
            })
            .catch(() => {
              pendingServerLocaleRef.current = null;
            });
        } else {
          pendingServerLocaleRef.current = null;
        }
      },
    }),
    [
      activeLocale,
      defaultLocale,
      isAuthenticated,
      isLoading,
      isMessagesLoading,
      localeNames,
      localeOptions,
      updatePreferencesMutation,
      userSettingsQuery.isLoading,
    ]
  );

  // Keep the synchronous store in sync for initial load and backend-driven
  // changes (e.g. server-side locale preference applied on sign-in).
  useEffect(() => {
    publishLocale(activeLocale);
  }, [activeLocale]);

  return (
    <MobileLocaleContext.Provider value={value}>
      <IntlProvider defaultLocale={DEFAULT_LOCALE} locale={activeLocale} messages={flattenMessages(messages)}>
        {children}
      </IntlProvider>
    </MobileLocaleContext.Provider>
  );
}

export function MobileIntlProvider({ children }: { children: React.ReactNode }) {
  return <MobileLocaleProviderInner>{children}</MobileLocaleProviderInner>;
}

export function MobileIntlFallbackProvider({ children }: { children: React.ReactNode }) {
  const fallback = useMemo<MobileLocaleContextValue>(
    () => ({
      locale: DEFAULT_LOCALE,
      enabledLocales: [{ code: DEFAULT_LOCALE, name: 'English' }],
      localeNames: { [DEFAULT_LOCALE]: 'English' },
      isLoading: false,
      setLocale: () => {},
    }),
    []
  );

  return (
    <MobileLocaleContext.Provider value={fallback}>
      <IntlProvider defaultLocale={DEFAULT_LOCALE} locale={DEFAULT_LOCALE} messages={{}}>
        {children}
      </IntlProvider>
    </MobileLocaleContext.Provider>
  );
}

export function useMobileLocaleSettings() {
  const context = useContext(MobileLocaleContext);

  if (!context) {
    throw new Error('useMobileLocaleSettings must be used inside MobileIntlProvider');
  }

  return context;
}
