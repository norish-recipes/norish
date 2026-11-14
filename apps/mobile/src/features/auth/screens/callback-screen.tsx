import React, { useEffect } from "react";
import { View } from "react-native";
import { Brand, useSplashBrandTop } from "@/components/brand";
import { useSigningIn } from "@/features/auth/hooks/use-signing-in";
import { useHasActiveSession } from "@/lib/auth/auth-session-sync";
import { Stack, useRouter } from "expo-router";
import { Spinner, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

// The signing-in group's 12pt gap plus the spinner's own 28pt margin.
const SPINNER_GAP = 40;

// Only an outside norish://auth/callback link opens this, as the sign-in sheet keeps its own
// return; a session leaves it through Stack.Protected, none by the deadline goes to Sign-in failed.
/** The splash with a spinner under the slogan: the brand sits exactly where the splash draws it. */
export function AuthCallbackScreen() {
  const intl = useIntl();
  const top = useSplashBrandTop();
  const [mutedColor] = useThemeColor(["muted"] as const);
  const router = useRouter();
  const outcome = useSigningIn(useHasActiveSession());

  useEffect(() => {
    if (outcome === "failed") router.replace("/auth/error");
  }, [outcome, router]);

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="absolute inset-x-0 items-center" style={{ top }}>
        <Brand />
        <Spinner
          accessibilityLabel={intl.formatMessage({ id: "auth.callback.signingIn" })}
          className="self-center"
          color={mutedColor}
          size="md"
          style={{ marginTop: SPINNER_GAP }}
          testID="signing-in-spinner"
        />
      </View>
    </View>
  );
}
