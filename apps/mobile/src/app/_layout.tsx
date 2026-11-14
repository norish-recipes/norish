import "@/global.css";
import "@/lib/i18n/plural-rules";

import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { LaunchProvider, LaunchSplash } from "@/components/launch";
import { FIT_SHEET_OPTIONS, SHEET_OPTIONS } from "@/components/sheet-options";
import { LaunchVersionCheck } from "@/features/auth/components/launch-version-check";
import { StorageUnavailableScreen } from "@/features/auth/screens/storage-unavailable-screen";
import { FADE_OUT_TIMING, PENDING_FADE_IN } from "@/features/auth/utils/motion";
import { useShareInbox } from "@/features/recipes/hooks/use-share-inbox";
import { useSignOutBeforeServerChange } from "@/hooks/use-change-server-address";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { useServerAddress } from "@/hooks/use-server-address";
import { useUserLocaleSync } from "@/hooks/use-user-locale-sync";
import { AuthProviders } from "@/lib/auth/auth-providers";
import { useSignedInFadingOut } from "@/lib/auth/auth-session-sync";
import { resolveBootPhase } from "@/lib/boot/boot-state";
import { MobileIntlFallbackProvider } from "@/lib/i18n/mobile-i18n-context";
import { ServerAddressContext } from "@/lib/network/server-address";
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

import { useCalendarSubscription } from "@norish/shared-react/calendar";
import { useConfigSubscription } from "@norish/shared-react/config";
import { usePantrySubscription } from "@norish/shared-react/groceries";
import { usePlatform } from "@norish/shared-react/platform";
import { useHouseholdSubscription, usePermissionsSubscription } from "@norish/shared-react/reader";
import {
  useCookbooksSubscription,
  useRatingsSubscription,
  useRecipeListSubscription,
  useRecipeOutcomesSubscription,
} from "@norish/shared-react/recipes";

// The boot gate renders nothing until hydration settles, so the native splash holds
// until every branch's LaunchSplash is laid out and hides it.
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

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <HeroUINativeProvider>
        <AppearancePreferenceProvider>
          <LaunchProvider>
            <RootLayoutContent />
          </LaunchProvider>
        </AppearancePreferenceProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}

// The boot gate: waits for hydration, then renders the provider tree.

function RootLayoutContent() {
  const { hydrated } = useAppearancePreference();
  const effectiveScheme = useResolvedColorScheme();

  const serverAddress = useServerAddress();
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
    serverAddress,
  });

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

  // Unreadable secure storage leaves the Server Address unknown; reading that as none
  // would drop a configured server, so the storage screen says so instead.
  if (boot.phase === "storage-error") {
    return (
      <ThemeProvider value={theme}>
        <MobileIntlFallbackProvider>
          <StorageUnavailableScreen onRetry={serverAddress.retry} />
          <LaunchSplash handoff="fade" />
        </MobileIntlFallbackProvider>
      </ThemeProvider>
    );
  }

  // No Server Address — minimal provider tree (setup / onboarding)
  if (boot.phase === "onboarding") {
    return (
      <ThemeProvider value={theme}>
        <MobileIntlFallbackProvider>
          <RootStack signedIn={false} />
          <PortalHost name="app" />
          <LaunchVersionCheck enabled />
          <LaunchSplash handoff="glide" />
        </MobileIntlFallbackProvider>
      </ThemeProvider>
    );
  }

  // Full provider tree — a Server Address is saved
  return (
    <ThemeProvider value={theme}>
      <ServerAddressContext value={boot.serverAddress}>
        <TrpcProvider
          baseUrl={boot.serverAddress}
          getQueryClient={getOfflineQueryClient}
          mutationLink={offlineEngine.outboxLink}
        >
          <ConnectivityProvider>
            <AuthProviders>
              <SessionStack />
            </AuthProviders>
          </ConnectivityProvider>
        </TrpcProvider>
      </ServerAddressContext>
    </ThemeProvider>
  );
}

const getOfflineQueryClient = () => offlineEngine.queryClient;

/** The stack, wrapped in the offline controller while signed in; held under the splash while pending. */
function SessionStack() {
  const { session } = usePlatform();
  const { colors } = useTheme();
  const signedIn = session.user !== null;
  const pending = session.isPending && !signedIn;

  const app = (
    <>
      <RootStack signedIn={signedIn} />
      <PortalHost name="app" />
    </>
  );

  // One themed ground under every phase, so a session ending never shows the bare window.
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {pending ? (
        <Animated.View entering={PENDING_FADE_IN} style={[styles.root, styles.centred]}>
          <ActivityIndicator />
        </Animated.View>
      ) : signedIn ? (
        <SignedInFade>
          <AuthenticatedProviders>{app}</AuthenticatedProviders>
        </SignedInFade>
      ) : (
        app
      )}
      <LaunchVersionCheck enabled={!pending} />
      <LaunchSplash handoff={pending ? null : "fade"} />
    </View>
  );
}

/** The signed-in screen, faded out ahead of a session's end so the end never cuts. */
function SignedInFade({ children }: { children: React.ReactNode }) {
  const fading = useSignedInFadingOut();
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(fading ? 0 : 1, FADE_OUT_TIMING),
  }));

  // Not interactive while it fades: the session it shows is already ending.
  return (
    <Animated.View pointerEvents={fading ? "none" : "auto"} style={[styles.root, style]}>
      {children}
    </Animated.View>
  );
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

/** Effects every signed-in tab leans on: the Reader's locale and the realtime subscriptions. */
function AuthenticatedEffects() {
  useSignOutBeforeServerChange();
  useUserLocaleSync();
  useHouseholdSubscription();
  usePermissionsSubscription();
  useConfigSubscription();
  // An import or a delete starts on any tab, so its outcome toasts here.
  useRecipeOutcomesSubscription();
  // What the Share Extension saved while the server was unreachable.
  useShareInbox();
  useRecipeListSubscription();
  useRatingsSubscription();
  useCookbooksSubscription();
  usePantrySubscription();
  useCalendarSubscription();

  return null;
}

/** A recipe opened from the Library: a transparent header with just the back arrow. */
const OPENED_SCREEN = {
  headerShown: true,
  headerTransparent: true,
  headerTitle: "",
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
} as const;

/** The import sheets as tall as their content; From text's field takes the sheet's height. */
const FIT_IMPORT_SHEETS = ["add-recipe", "import-link", "import-photos"] as const;

function RootStack({ signedIn }: { signedIn: boolean }) {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="recipe/[id]" options={OPENED_SCREEN} />
        <Stack.Screen name="recipe/new" options={OPENED_SCREEN} />
        {/* Add recipe and its imports present over whichever tab the accessory was pressed on. */}
        {FIT_IMPORT_SHEETS.map((name) => (
          <Stack.Screen key={name} name={name} options={FIT_SHEET_OPTIONS} />
        ))}
        <Stack.Screen name="import-text" options={SHEET_OPTIONS} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      {/* Reachable signed in or out, with no swipe back: only a new enough server leaves it. */}
      <Stack.Screen
        name="update-server"
        options={({ route }) => ({
          // Opened under the launch splash, it cuts in so the splash's own fade reveals it.
          animation: route.params && "instant" in route.params ? "none" : "fade",
          gestureEnabled: false,
        })}
      />
    </Stack>
  );
}

// ============================================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centred: {
    alignItems: "center",
    justifyContent: "center",
  },
});
