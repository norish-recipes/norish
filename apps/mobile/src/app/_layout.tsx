import "@/global.css";

import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StorageUnavailableScreen } from "@/features/auth/screens/storage-unavailable-screen";
import { useBackendBaseUrl } from "@/hooks/use-backend-base-url";
import { useCacheHydration } from "@/hooks/use-cache-hydration";
import { useCacheInvalidationOnReconnect } from "@/hooks/use-cache-lifecycle";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useSessionRevalidation } from "@/hooks/use-session-revalidation";
import { useUserLocaleSync } from "@/hooks/use-user-locale-sync";
import { AuthProvider, useAuth } from "@/lib/auth/auth-context";
import { UserProvider } from "@/lib/auth/user-context";
import { resolveBootPhase } from "@/lib/boot/boot-state";
import { MobileIntlFallbackProvider, MobileIntlProvider } from "@/lib/i18n/mobile-i18n-context";
import { NetworkProvider } from "@/lib/network/network-context";
import {
  AppearancePreferenceProvider,
  useAppearancePreference,
} from "@/lib/preferences/appearance-preference-context";
import { TrpcProvider } from "@/lib/trpc/trpc-provider";
import { Stack } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider } from "heroui-native";
import { PortalHost } from "heroui-native/portal";

// The boot gate below renders nothing until hydration settles. Holding the
// native splash over that window is what keeps it from showing as a blank
// screen; every branch of the gate hides it again.
void SplashScreen.preventAutoHideAsync();

// ============================================================================
// Entry point
// ============================================================================

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

// ============================================================================
// Boot gate — waits for hydration, then renders provider tree
// ============================================================================

function RootLayoutContent() {
  const { hydrated } = useAppearancePreference();
  const effectiveScheme = useResolvedColorScheme();

  const backendBaseUrl = useBackendBaseUrl();
  const cacheReady = useCacheHydration();

  const boot = resolveBootPhase({
    appearanceHydrated: hydrated,
    cacheReady,
    backendBaseUrl,
  });

  // Hand the screen over from the native splash only once there is something to
  // show, including the failure case: a boot that cannot finish still has to say
  // so rather than sit under the splash forever.
  useEffect(() => {
    if (boot.phase !== "loading") void SplashScreen.hideAsync();
  }, [boot.phase]);

  // Gate: wait for all async hydration before rendering anything
  if (boot.phase === "loading") {
    return null;
  }

  const theme = effectiveScheme === "dark" ? DarkTheme : DefaultTheme;

  // Secure storage could not be read, so which backend this install belongs to
  // is unknown. Treating that as "no backend configured" would quietly drop a
  // configured server, so surface it instead.
  if (boot.phase === "storage-error") {
    return (
      <ThemeProvider value={theme}>
        <MobileIntlFallbackProvider>
          <StorageUnavailableScreen error={boot.error} onRetry={backendBaseUrl.retry} />
        </MobileIntlFallbackProvider>
      </ThemeProvider>
    );
  }

  // No backend URL configured — minimal provider tree (setup / onboarding)
  if (boot.phase === "onboarding") {
    return (
      <ThemeProvider value={theme}>
        <AuthProvider backendBaseUrl={null}>
          <MobileIntlFallbackProvider>
            <RootStack />
            <PortalHost name="app" />
          </MobileIntlFallbackProvider>
        </AuthProvider>
      </ThemeProvider>
    );
  }

  // Full provider tree — backend available
  return (
    <ThemeProvider value={theme}>
      <NetworkProvider backendBaseUrl={boot.backendBaseUrl}>
        <TrpcProvider baseUrl={boot.backendBaseUrl}>
          <AuthProvider backendBaseUrl={boot.backendBaseUrl}>
            <MobileIntlProvider>
              <DomainProviders>
                <RootStack />
                <PortalHost name="app" />
              </DomainProviders>
            </MobileIntlProvider>
          </AuthProvider>
        </TrpcProvider>
      </NetworkProvider>
    </ThemeProvider>
  );
}

// ============================================================================
// Domain providers — added only when authenticated
// ============================================================================

/**
 * When authenticated, wraps children with the user provider. When
 * unauthenticated, renders children directly.
 */
function DomainProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return children;
  }

  return <AuthenticatedProviders>{children}</AuthenticatedProviders>;
}

function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  useCacheInvalidationOnReconnect();
  useSessionRevalidation();

  return (
    <UserProvider>
      <AuthenticatedEffects />
      {children}
    </UserProvider>
  );
}

/** Hooks that require UserProvider + MobileIntlProvider. */
function AuthenticatedEffects() {
  useUserLocaleSync();
  return null;
}

// ============================================================================
// Navigation
// ============================================================================

function RootStack() {
  const { isAuthenticated } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="smoke" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

// ============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
