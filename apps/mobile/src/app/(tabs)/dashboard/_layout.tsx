import React from "react";
import { Platform } from "react-native";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { SettingsMenu } from "@/components/shell/settings-menu";
import { useNetworkStatus } from "@/context/network-context";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

export default function RecipesLayout() {
  const intl = useIntl();
  const { mode, runtimeState } = useNetworkStatus();

  const showOfflineIndicator = runtimeState === "ready" && mode !== "online";

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLargeTitle: true,
        headerTransparent: Platform.OS === "ios",
        headerShadowVisible: false,
        headerLargeTitleShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: intl.formatMessage({ id: "recipes.dashboard.title" }),
          headerLeft: showOfflineIndicator ? () => <OfflineBanner /> : undefined,
          headerRight: () => <SettingsMenu />,
        }}
      />
      {/* Recipe detail — header options are set directly in the screen component
          to access glass buttons and transparent header configuration. */}
      <Stack.Screen
        name="recipe/[id]"
        options={{
          headerLargeTitle: false,
        }}
      />
    </Stack>
  );
}
