"use client";

import { useDevicePreference } from "@/context/device-preferences-context";

/** Grid or list, for the library and every cookbook. */
export function useRecipeDashboardViewMode() {
  return useDevicePreference("recipeViewMode");
}
