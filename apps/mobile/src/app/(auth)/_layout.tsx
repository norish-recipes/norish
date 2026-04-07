import React from "react";
import { Platform } from "react-native";
import { AuthLocaleMenu } from "@/components/shell/auth-locale-menu";
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: Platform.OS === "ios",
        headerShadowVisible: false,
        headerTitle: "",
        headerRight: () => <AuthLocaleMenu />,
        // Use 'none' so the shared auth shell (logo + card border) appears to
        // stay in place when navigating between connect/login/register. The
        // visual transition is handled by Reanimated layout animations inside
        // each pane's content, not by the navigator.
        animation: "default",
      }}
    />
  );
}
