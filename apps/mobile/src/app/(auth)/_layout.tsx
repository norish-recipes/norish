import React from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: Platform.OS === "ios",
        headerShadowVisible: false,
        headerTitle: "",
        // The back button is the board's icon alone, with no previous title.
        headerBackButtonDisplayMode: "minimal",
        // The native push and pop between the auth screens.
        animation: "default",
      }}
    />
  );
}
