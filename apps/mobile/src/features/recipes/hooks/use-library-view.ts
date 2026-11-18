import { useSyncExternalStore } from "react";

import type { RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";
import { useDevicePreference } from "@norish/shared-react/reader";

// Module scope: the pick is shown at once and kept even if its save fails, so a refused write
// never flips the view back; the saved Device Preference answers until the first pick.
let picked: RecipeViewMode | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => void listeners.delete(listener);
};

/** The Library's grid or list: the reader's pick on screen at once, saved in the background. */
export function useLibraryView() {
  const [saved, save] = useDevicePreference("recipeViewMode");
  const local = useSyncExternalStore(subscribe, () => picked);

  const setView = (mode: RecipeViewMode) => {
    picked = mode;
    listeners.forEach((listener) => listener());
    save(mode);
  };

  return [local ?? saved, setView] as const;
}
