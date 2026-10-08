"use client";

import { useDevicePreference } from "@/context/device-preferences-context";

/** Fractions or decimals: a Device Preference, right from the first frame. */
export function useAmountDisplayMode() {
  return useDevicePreference("amountDisplay");
}
