"use client";

import type { HiddenItemVisibility } from "@/lib/hidden-items";
import { useDevicePreference } from "@/context/device-preferences-context";
import { hiddenItemVisibility } from "@/lib/hidden-items";

/**
 * The reader's Hidden Item choices as visibility flags, derived in one place
 * so every consumer answers "is this shown for this reader?" the same way.
 * Reads the seeded hidden list, so the answer is right from the first frame.
 */
export function useHiddenItemVisibility(): HiddenItemVisibility {
  const [hidden] = useDevicePreference("hiddenItems");

  return hiddenItemVisibility(hidden);
}
