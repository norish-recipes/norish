import "@/global.css";
import "@/lib/i18n/plural-rules";

import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StorageUnavailableScreen } from "@/features/auth/screens/storage-unavailable-screen";
import { useBackendBaseUrl } from "@/hooks/use-backend-base-url";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useUserLocaleSync } from "@/hooks/use-user-locale-sync";
import { AuthProvider, useAuth } from "@/lib/auth/auth-context";
import { resolveBootPhase } from "@/lib/boot/boot-state";
import { MobileIntlFallbackProvider, MobileIntlProvider } from "@/lib/i18n/mobile-i18n-context";
import { ConnectivityProvider, OfflineController, offlineEngine } from "@/lib/offline/engine";
import { MobilePlatformProvider } from "@/lib/platform/platform-provider";
import {
  AppearancePreferenceProvider,
  useAppearancePreference,
} from "@/lib/preferences/appearance-preference-context";
import { TrpcProvider } from "@/lib/trpc/trpc-provider";
import { FiraCode_400Regular } from "@expo-google-fonts/fira-code/400Regular";
import { Fraunces_500Medium } from "@expo-google-fonts/fraunces/500Medium";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider, useThemeColor } from "heroui-native";
import { PortalHost } from "heroui-native/portal";

import { useHouseholdSubscription, usePermissionsSubscription } from "@norish/shared-react/reader";

// The boot gate below renders nothing until hydration settles. Holding the
// native splash over that window is what keeps it from showing as a blank
// screen; every branch of the gate hides it again.
void SplashScreen.preventAutoHideAsync();

// The faces the font tokens in global.css name.
const FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Fraunces_500Medium,
  FiraCode_400Regular,
};

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
  const [fontsLoaded, fontsError] = useFonts(FONTS);
  const [background, foreground, border, accent, danger] = useThemeColor([
    "background",
    "foreground",
    "border",
    "accent",
    "danger",
  ] as const);

  const boot = resolveBootPhase({
    appearanceHydrated: hydrated,
    fontsReady: fontsLoaded || fontsError !== null,
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

  // The navigator paints the screens' ground, so it takes the shared theme's colours too.
  const theme = {
    ...(effectiveScheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      primary: accent,
      background,
      card: background,
      text: foreground,
      border,
      notification: danger,
    },
  };

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
      <TrpcProvider
        baseUrl={boot.backendBaseUrl}
        getQueryClient={getOfflineQueryClient}
        mutationLink={offlineEngine.outboxLink}
      >
        <ConnectivityProvider>
          <AuthProvider backendBaseUrl={boot.backendBaseUrl}>
            <MobileIntlProvider>
              <MobilePlatformProvider>
                <DomainProviders>
                  <RootStack />
                  <PortalHost name="app" />
                </DomainProviders>
              </MobilePlatformProvider>
            </MobileIntlProvider>
          </AuthProvider>
        </ConnectivityProvider>
      </TrpcProvider>
    </ThemeProvider>
  );
}

// ============================================================================
// Domain providers — added only when authenticated
// ============================================================================

const getOfflineQueryClient = () => offlineEngine.queryClient;

/** When authenticated, wraps children with the offline controller; otherwise renders them. */
function DomainProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return children;
  }

  return <AuthenticatedProviders>{children}</AuthenticatedProviders>;
}

function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <OfflineController sessionUserId={user?.id ?? null}>
      <AuthenticatedEffects />
      {children}
    </OfflineController>
  );
}

/** The signed-in shell's effects: the Reader's locale and subscriptions. */
function AuthenticatedEffects() {
  useUserLocaleSync();
  useHouseholdSubscription();
  usePermissionsSubscription();

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
