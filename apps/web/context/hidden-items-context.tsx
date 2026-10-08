"use client";

import type { DevicePreferenceState } from "@/context/device-preferences-context";
import { useDevicePreference } from "@/context/device-preferences-context";

/**
 * The hidden list governing this render, known from the very first frame:
 * a Device Preference, so the App Shell's provider has it from the server
 * pass, or from the restored profile on Offline start-up. Every consumer of
 * Hidden Items reads it here, so nothing hideable renders before it is known.
 */
export function useHiddenItemsState(): DevicePreferenceState<string[]> {
  return useDevicePreference("hiddenItems");
}

export function useHiddenItems(): readonly string[] {
  return useDevicePreference("hiddenItems")[0];
}
