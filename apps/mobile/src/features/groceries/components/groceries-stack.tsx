import React from "react";
import { FIT_SHEET_OPTIONS, SEARCH_SHEET_OPTIONS } from "@/components/sheet-options";
import { Stack } from "expo-router";

/** The Groceries tab's stack: the page holding the list and the Pantry, and the sheets presented
 * over it. */
export function GroceriesStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" options={FIT_SHEET_OPTIONS} />
      <Stack.Screen name="edit" options={FIT_SHEET_OPTIONS} />
      <Stack.Screen name="stores" options={SEARCH_SHEET_OPTIONS} />
      <Stack.Screen name="pantry-add" options={SEARCH_SHEET_OPTIONS} />
      <Stack.Screen name="food" options={FIT_SHEET_OPTIONS} />
    </Stack>
  );
}
