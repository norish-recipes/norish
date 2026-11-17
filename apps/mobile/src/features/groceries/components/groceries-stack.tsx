import React from "react";
import { FIT_SHEET_OPTIONS, SEARCH_SHEET_OPTIONS } from "@/components/sheet-options";
import { Stack } from "expo-router";

/** The Groceries tab's stack: the list has a native large title; its sheets present over it, and the
 * Pantry is pushed on it with a fade. */
export function GroceriesStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" options={FIT_SHEET_OPTIONS} />
      <Stack.Screen name="edit" options={FIT_SHEET_OPTIONS} />
      <Stack.Screen name="stores" options={SEARCH_SHEET_OPTIONS} />
      <Stack.Screen name="pantry" options={{ animation: "fade" }} />
      <Stack.Screen name="pantry-add" options={SEARCH_SHEET_OPTIONS} />
      <Stack.Screen name="food" options={FIT_SHEET_OPTIONS} />
    </Stack>
  );
}
