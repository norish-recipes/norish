import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { HeroUINativeProvider } from 'heroui-native';
import { PortalHost } from 'heroui-native/portal';
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import {
  AppearancePreferenceProvider,
  useAppearancePreference,
} from '@/context/appearance-preference-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { MobileIntlFallbackProvider, MobileIntlProvider } from '@/context/mobile-i18n-context';
import { PermissionsProvider } from '@/context/permissions-context';
import { RecipeFiltersProvider } from '@/context/recipe-filters-context';
import { RecipesProvider } from '@/context/recipes-context';
import { UserProvider } from '@/context/user-context';
import {
  loadBackendBaseUrl,
  subscribeBackendBaseUrlChange,
} from '@/lib/network/backend-base-url';
import { TrpcProvider } from '@/providers/trpc-provider';

function AuthGatedProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <MobileIntlProvider>
        {children}
      </MobileIntlProvider>
    );
  }

  return (
    <AuthenticatedProviders>
      {children}
    </AuthenticatedProviders>
  );
}

function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  return (
    <RecipeFiltersProvider>
      <PermissionsProvider>
        <UserProvider>
          <RecipesProvider>
            <MobileIntlProvider>
              {children}
            </MobileIntlProvider>
          </RecipesProvider>
        </UserProvider>
      </PermissionsProvider>
    </RecipeFiltersProvider>
  );
}

function RootStack() {
  const { isAuthenticated } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

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

  const effectiveScheme =
    mode === 'system' ? (systemColorScheme ?? 'light') : mode;

  if (backendBaseUrl) {
    return (
      <ThemeProvider value={effectiveScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <TrpcProvider baseUrl={backendBaseUrl}>
          <AuthProvider backendBaseUrl={backendBaseUrl}>
            <AuthGatedProviders>
              <RootStack />
              <PortalHost name="app" />
            </AuthGatedProviders>
          </AuthProvider>
        </TrpcProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={effectiveScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider backendBaseUrl={null}>
        <MobileIntlFallbackProvider>
          <RootStack />
          <PortalHost name="app" />
        </MobileIntlFallbackProvider>
      </AuthProvider>
    </ThemeProvider>
  );
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
