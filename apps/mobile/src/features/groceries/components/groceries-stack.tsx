import React from "react";
import { FIT_SHEET_OPTIONS, FORM_SHEET_OPTIONS, SHEET_OPTIONS } from "@/components/sheet-options";
import { Stack } from "expo-router";

/** The Groceries tab's stack: the list draws its own title and has no native header; Add items, the edit sheet, Manage stores and the Pantry's add sheet present over it, and the Pantry replaces it with a fade. */
export function GroceriesStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" options={FORM_SHEET_OPTIONS} />
      <Stack.Screen name="edit" options={FORM_SHEET_OPTIONS} />
      <Stack.Screen name="stores" options={SHEET_OPTIONS} />
      <Stack.Screen name="pantry" options={{ animation: "fade" }} />
      <Stack.Screen name="pantry-add" options={SHEET_OPTIONS} />
      <Stack.Screen name="food" options={FIT_SHEET_OPTIONS} />
    </Stack>
  );
}
