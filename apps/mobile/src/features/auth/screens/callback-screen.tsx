import React from "react";
import { useWindowDimensions, View } from "react-native";
import { Brand, BRAND_HEIGHT } from "@/components/brand";
import { Stack } from "expo-router";
import { Spinner, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

// The spinner's 28pt gap under the slogan, from the SigningIn board.
const SPINNER_GAP = 28;

// @better-auth/expo's expoClient takes the session cookie from the norish:// deep link;
// the root layout's Stack.Protected guard then leaves this screen.
/** The splash with a spinner under the slogan: the brand sits exactly where the splash draws it. */
export function AuthCallbackScreen() {
  const intl = useIntl();
  const { height } = useWindowDimensions();
  const [mutedColor] = useThemeColor(["muted"] as const);

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="absolute inset-x-0 items-center"
        style={{ top: (height - BRAND_HEIGHT) / 2 }}
      >
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
