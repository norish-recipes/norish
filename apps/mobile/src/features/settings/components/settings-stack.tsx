import React from "react";
import { EDITOR_OPTIONS } from "@/components/sheet-options";
import { HEADER_TITLE_STYLE } from "@/lib/header-title";
import { Stack } from "expo-router";

/** Settings' stack, pushed over the tabs: each page draws its own back header (`SettingsPage`). */
export function SettingsStack() {
  return (
    <Stack screenOptions={{ ...EDITOR_OPTIONS, headerTitleStyle: HEADER_TITLE_STYLE }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
