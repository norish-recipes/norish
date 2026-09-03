import "@/global.css";

import React, { useEffect } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  AppearancePreferenceProvider,
  useAppearancePreference,
} from "@/context/appearance-preference-context";
import { StorageUnavailableScreen } from "@/components/shell/storage-unavailable-screen";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { GroceriesProvider } from "@/context/groceries-context";
import { HouseholdProvider } from "@/context/household-context";
import { MobileIntlFallbackProvider, MobileIntlProvider } from "@/context/mobile-i18n-context";
import { NetworkProvider } from "@/context/network-context";
import { PermissionsProvider } from "@/context/permissions-context";
import { RecipeFiltersProvider } from "@/context/recipe-filters-context";
import { RecipesProvider } from "@/context/recipes-context";
import { StoresProvider } from "@/context/stores-context";
import { UserProvider } from "@/context/user-context";
import { useBackendBaseUrl } from "@/hooks/use-backend-base-url";
import { resolveBootPhase } from "@/lib/boot/boot-state";
import { useCacheHydration } from "@/hooks/use-cache-hydration";
import { useCacheInvalidationOnReconnect } from "@/hooks/use-cache-lifecycle";
import { useSessionRevalidation } from "@/hooks/use-session-revalidation";
import { useUserLocaleSync } from "@/hooks/use-user-locale-sync";
import { TrpcProvider } from "@/providers/trpc-provider";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
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
  const { hydrated, mode } = useAppearancePreference();
  const systemColorScheme = useColorScheme();

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

  const effectiveScheme = mode === "system" ? (systemColorScheme ?? "light") : mode;

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
 * When authenticated, wraps children with domain-specific providers
 * (permissions, user, recipes, filters). When unauthenticated, renders
 * children directly.
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
    <RecipeFiltersProvider>
      <PermissionsProvider>
        <UserProvider>
          <AuthenticatedEffects />
          <HouseholdProvider>
            <RecipesProvider>
              <StoresProvider>
                <GroceriesProvider>{children}</GroceriesProvider>
              </StoresProvider>
            </RecipesProvider>
          </HouseholdProvider>
        </UserProvider>
      </PermissionsProvider>
    </RecipeFiltersProvider>
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
        <Stack.Screen name="(tabs)" />
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
