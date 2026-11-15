import React from "react";
import { SHEET_OPTIONS } from "@/components/sheet-options";
import { Stack } from "expo-router";

/** The Groceries tab's stack: the list draws its own title and has no native header; Add items and the edit sheet present over it. */
export function GroceriesStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add" options={SHEET_OPTIONS} />
      <Stack.Screen name="edit" options={SHEET_OPTIONS} />
    </Stack>
  );
}
