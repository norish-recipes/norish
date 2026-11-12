import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Brand, useSplashBrandTop } from "@/components/brand";
import { SIGN_IN_DEADLINE_MS } from "@/features/auth/utils/auth-failure";
import { resolveSigningIn } from "@/features/auth/utils/signing-in";
import { useHasActiveSession } from "@/lib/auth/auth-session-sync";
import { Stack, useRouter } from "expo-router";
import { Spinner, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

// The SigningIn board's 12pt group gap plus the spinner's own 28pt margin.
const SPINNER_GAP = 40;

// Only an outside norish://auth/callback link opens this, as the sign-in sheet keeps its own
// return; a session leaves it through Stack.Protected, none by the deadline goes to Sign-in failed.
/** The splash with a spinner under the slogan: the brand sits exactly where the splash draws it. */
export function AuthCallbackScreen() {
  const intl = useIntl();
  const top = useSplashBrandTop();
  const [mutedColor] = useThemeColor(["muted"] as const);
  const router = useRouter();
  const [waited, setWaited] = useState(0);
  const outcome = resolveSigningIn(useHasActiveSession(), waited);

  useEffect(() => {
    const timer = setTimeout(() => setWaited(SIGN_IN_DEADLINE_MS), SIGN_IN_DEADLINE_MS);

    return () => clearTimeout(timer);
  }, []);

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
