"use client";

import { useDevicePreference } from "@/context/device-preferences-context";

/**
 * Dish colour or plain theme on recipe pages: a Device Preference, so a
 * reader who chose the theme renders untinted on the very first frame.
 */
export function useRecipePageColor() {
  return useDevicePreference("recipePageColor");
}
