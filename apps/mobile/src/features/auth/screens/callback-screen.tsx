import React, { useEffect } from "react";
import { View } from "react-native";
import { Brand, LOADER_GAP, useSplashBrandTop } from "@/components/brand";
import { Loader } from "@/components/loader";
import { useSigningIn } from "@/features/auth/hooks/use-signing-in";
import { useHasActiveSession } from "@/lib/auth/auth-session-sync";
import { Stack, useRouter } from "expo-router";
import { useIntl } from "react-intl";

// Only an outside norish://auth/callback link opens this, as the sign-in sheet keeps its own
// return; a session leaves it through Stack.Protected, none by the deadline goes to Sign-in failed.
/** The splash with a spinner under the slogan: the brand sits exactly where the splash draws it. */
export function AuthCallbackScreen() {
  const intl = useIntl();
  const top = useSplashBrandTop();
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
        <View style={{ marginTop: LOADER_GAP }}>
          <Loader
            inline
            label={intl.formatMessage({ id: "auth.callback.signingIn" })}
            size="large"
            testID="signing-in-spinner"
          />
        </View>
      </View>
    </View>
  );
}
