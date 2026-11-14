"use client";

import type { HiddenItemVisibility } from "./hidden-items";
import { hiddenItemVisibility } from "./hidden-items";
import { useDevicePreference } from "./use-device-preference";

/** The reader's Hidden Item choices as visibility flags, read from the seeded list so they are
 * right from the first frame. */
export function useHiddenItemVisibility(): HiddenItemVisibility {
  const [hidden] = useDevicePreference("hiddenItems");

  return hiddenItemVisibility(hidden);
}
