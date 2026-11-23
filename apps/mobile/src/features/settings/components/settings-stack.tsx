import React from "react";
import { EDITOR_OPTIONS, FIT_SHEET_OPTIONS } from "@/components/sheet-options";
import { HEADER_TITLE_STYLE } from "@/lib/header-title";
import { Stack } from "expo-router";

/** Settings' stack, pushed over the tabs: each page draws its own back header (`SettingsPage`). */
export function SettingsStack() {
  return (
    <Stack screenOptions={{ ...EDITOR_OPTIONS, headerTitleStyle: HEADER_TITLE_STYLE }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="password" options={FIT_SHEET_OPTIONS} />
      <Stack.Screen name="token-new" options={FIT_SHEET_OPTIONS} />
    </Stack>
  );
}
