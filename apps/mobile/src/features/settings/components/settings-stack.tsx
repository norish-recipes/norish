import React from "react";
import {
  EDITOR_OPTIONS,
  FIT_SHEET_OPTIONS,
  SEARCH_SHEET_OPTIONS,
  SHEET_OPTIONS,
} from "@/components/sheet-options";
import { HEADER_TITLE_STYLE } from "@/lib/header-title";
import { Stack } from "expo-router";

import { SettingsWriteNotice } from "./settings-write-notice";

/** Settings' stack, pushed over the tabs: each page draws its own back header (`SettingsPage`). */
export function SettingsStack() {
  return (
    <>
      <SettingsWriteNotice />
      <Stack screenOptions={{ ...EDITOR_OPTIONS, headerTitleStyle: HEADER_TITLE_STYLE }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="password" options={FIT_SHEET_OPTIONS} />
        <Stack.Screen name="token-new" options={FIT_SHEET_OPTIONS} />
        <Stack.Screen name="content-add" options={FIT_SHEET_OPTIONS} />
        <Stack.Screen name="content-entry" options={FIT_SHEET_OPTIONS} />
        <Stack.Screen name="ingredient" options={FIT_SHEET_OPTIONS} />
        <Stack.Screen name="ingredient-add" options={FIT_SHEET_OPTIONS} />
        <Stack.Screen name="ingredient-filters" options={SHEET_OPTIONS} />
        <Stack.Screen name="ingredient-changes" options={SEARCH_SHEET_OPTIONS} />
        <Stack.Screen name="content-uses" options={SEARCH_SHEET_OPTIONS} />
        {/* A fit-to-contents sheet in this nested stack keeps its first height, which would clip
            the created key that replaces the form: one fixed height holds both. */}
        <Stack.Screen
          name="api-key-new"
          options={{
            ...SHEET_OPTIONS,
            sheetGrabberVisible: false,
            sheetAllowedDetents: [0.62],
            sheetExpandsWhenScrolledToEdge: false,
          }}
        />
      </Stack>
    </>
  );
}
