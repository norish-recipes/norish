"use client";

import type { HiddenItemVisibility } from "./hidden-items";
import { hiddenItemVisibility } from "./hidden-items";
import { useDevicePreference } from "./use-device-preference";

/**
 * The reader's Hidden Item choices as visibility flags, derived in one place
 * so every consumer answers "is this shown for this reader?" the same way.
 * Reads the seeded hidden list, so the answer is right from the first frame.
 */
export function useHiddenItemVisibility(): HiddenItemVisibility {
  const [hidden] = useDevicePreference("hiddenItems");

  return hiddenItemVisibility(hidden);
}
