import React from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";

export default function GroceriesLayout() {
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
      <Stack.Screen name="index" options={{ title: "Groceries" }} />
    </Stack>
  );
}
