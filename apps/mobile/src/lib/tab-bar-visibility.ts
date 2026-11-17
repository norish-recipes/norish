import { useEffect } from "react";
import { useIsFocused } from "expo-router";

import { createMark } from "./mark";

// How many screens with their own chrome, and how many sheets, are mounted and in front.
const hiders = createMark(0);
const sheets = createMark(0);

/** Whether the tab bar goes: a screen with its own chrome is in front, or a sheet is open. */
export const useTabBarHidden = () => hiders.use() + sheets.use() > 0;

/** Whether a sheet is mounted and in front right now. */
export const isSheetOpen = () => sheets.get() > 0;

/** Counts the caller in `store` while `active`. */
function useCounted(store: ReturnType<typeof createMark<number>>, active: boolean) {
  useEffect(() => {
    if (!active) return;

    store.update((count) => count + 1);

    return () => store.update((count) => count - 1);
  }, [store, active]);
}

/** Hides the tab bar while the calling screen is mounted and in front: cook mode, the editor and the media viewer, which have their own chrome. */
export function useHideTabBar() {
  useCounted(hiders, useIsFocused());
}

/** Marks a sheet open while it is mounted and in front, so a link to another tab shows that tab's
 * bar: the shared `Sheet` calls this. */
export function useMarkSheetOpen() {
  useCounted(sheets, useIsFocused());
}
