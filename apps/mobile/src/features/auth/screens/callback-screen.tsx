import React from "react";
import { View } from "react-native";
import { Brand, useSplashBrandTop } from "@/components/brand";
import { Stack } from "expo-router";
import { Spinner, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

// The SigningIn board's 12pt group gap plus the spinner's own 28pt margin.
const SPINNER_GAP = 40;

// @better-auth/expo's expoClient takes the session cookie from the norish:// deep link;
// the root layout's Stack.Protected guard then leaves this screen.
/** The splash with a spinner under the slogan: the brand sits exactly where the splash draws it. */
export function AuthCallbackScreen() {
  const intl = useIntl();
  const top = useSplashBrandTop();
  const [mutedColor] = useThemeColor(["muted"] as const);

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
