import "@/global.css";
import "@/lib/i18n/plural-rules";

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StorageUnavailableScreen } from "@/features/auth/screens/storage-unavailable-screen";
import { useBackendBaseUrl } from "@/hooks/use-backend-base-url";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useUserLocaleSync } from "@/hooks/use-user-locale-sync";
import { AuthProviders } from "@/lib/auth/auth-providers";
import { resolveBootPhase } from "@/lib/boot/boot-state";
import { MobileIntlFallbackProvider } from "@/lib/i18n/mobile-i18n-context";
import { BackendBaseUrlContext } from "@/lib/network/backend-base-url";
import { ConnectivityProvider, OfflineController, offlineEngine } from "@/lib/offline/engine";
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
import { DarkTheme, DefaultTheme, ThemeProvider, useTheme } from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import { HeroUINativeProvider, useThemeColor } from "heroui-native";
import { PortalHost } from "heroui-native/portal";

import { usePlatform } from "@norish/shared-react/platform";
import {
  useHouseholdSubscription,
  usePermissionsSubscription,
  useSessionExpiry,
} from "@norish/shared-react/reader";

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
        <MobileIntlFallbackProvider>
          <RootStack signedIn={false} />
          <PortalHost name="app" />
        </MobileIntlFallbackProvider>
      </ThemeProvider>
    );
  }

  // Full provider tree — backend available
  return (
    <ThemeProvider value={theme}>
      <BackendBaseUrlContext value={boot.backendBaseUrl}>
        <TrpcProvider
          baseUrl={boot.backendBaseUrl}
          getQueryClient={getOfflineQueryClient}
          mutationLink={offlineEngine.outboxLink}
        >
          <ConnectivityProvider>
            <AuthProviders>
              <SessionStack />
            </AuthProviders>
          </ConnectivityProvider>
        </TrpcProvider>
      </BackendBaseUrlContext>
    </ThemeProvider>
  );
}

// ============================================================================
// Session stack — the stack for the platform's session
// ============================================================================

const getOfflineQueryClient = () => offlineEngine.queryClient;

/** The stack, wrapped in the offline controller while signed in; the bare ground while pending. */
function SessionStack() {
  const { session } = usePlatform();
  const { colors } = useTheme();
  const signedIn = session.user !== null;

  if (session.isPending && !signedIn) {
    return <View style={[styles.root, { backgroundColor: colors.background }]} />;
  }

  const app = (
    <>
      <RootStack signedIn={signedIn} />
      <PortalHost name="app" />
    </>
  );

  return signedIn ? <AuthenticatedProviders>{app}</AuthenticatedProviders> : app;
}

function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  const { user } = usePlatform().session;

  return (
    <OfflineController sessionUserId={user?.id ?? null}>
      <AuthenticatedEffects />
      {children}
    </OfflineController>
  );
}

/** The signed-in shell's effects: the Reader's locale, subscriptions and Session Expiry. */
function AuthenticatedEffects() {
  useUserLocaleSync();
  useHouseholdSubscription();
  usePermissionsSubscription();
  useSessionExpiry();

  return null;
}

// ============================================================================
// Navigation
// ============================================================================

function RootStack({ signedIn }: { signedIn: boolean }) {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="smoke" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
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
