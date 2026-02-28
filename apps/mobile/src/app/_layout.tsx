import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Slot } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import React, { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  AppearancePreferenceProvider,
  useAppearancePreference,
} from '@/context/appearance-preference-context';
import {
  loadBackendBaseUrl,
  subscribeBackendBaseUrlChange,
} from '@/lib/network/backend-base-url';
import { MobileTrpcProvider } from '@/providers/mobile-trpc-provider';

function RootLayoutContent() {
  const { hydrated, mode } = useAppearancePreference();
  const systemColorScheme = useColorScheme();
  const [backendBaseUrl, setBackendBaseUrl] = useState<string | null>(null);
  const [backendHydrated, setBackendHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const refreshBackendBaseUrl = async () => {
      const nextBaseUrl = await loadBackendBaseUrl();

      if (!isMounted) {
        return;
      }

      setBackendBaseUrl(nextBaseUrl);
      setBackendHydrated(true);
    };

    const unsubscribe = subscribeBackendBaseUrlChange(() => {
      void refreshBackendBaseUrl();
    });

    void refreshBackendBaseUrl();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (!hydrated || !backendHydrated) {
    return null;
  }

  // Resolve the effective color scheme: prefer explicit mode, fall back to system
  const effectiveScheme =
    mode === 'system' ? (systemColorScheme ?? 'light') : mode;

  const content = (
    <ThemeProvider value={effectiveScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Slot />
    </ThemeProvider>
  );

  if (!backendBaseUrl) {
    return content;
  }

  return <MobileTrpcProvider baseUrl={backendBaseUrl}>{content}</MobileTrpcProvider>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <HeroUINativeProvider>
        <AppearancePreferenceProvider>
          <RootLayoutContent />
        </AppearancePreferenceProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
