import { useEffect, useSyncExternalStore } from "react";
import { useIsFocused } from "expo-router";

let hiders = 0;
let sheets = 0;
const listeners = new Set<() => void>();

const change = (counter: "hiders" | "sheets", by: number) => {
  if (counter === "hiders") hiders += by;
  else sheets += by;
  listeners.forEach((listener) => listener());
};

const useStore = <T>(snapshot: () => T) =>
  useSyncExternalStore((listener) => {
    listeners.add(listener);

    return () => void listeners.delete(listener);
  }, snapshot);

/** Whether the tab bar goes: a screen with its own chrome is in front, or a sheet is open. */
export const useTabBarHidden = () => useStore(() => hiders + sheets > 0);

/** Whether a sheet is over the page: its glass shows what is under it, such as a page's bottom bar. */
export const useSheetOpen = () => useStore(() => sheets > 0);

/** Counts the caller in `counter` while `active`. */
function useCounted(counter: "hiders" | "sheets", active: boolean) {
  useEffect(() => {
    if (!active) return;

    change(counter, 1);

    return () => change(counter, -1);
  }, [counter, active]);
}

/** Hides the tab bar while the calling screen is mounted and in front: the recipe page, which has its own chrome. */
export function useHideTabBar() {
  useCounted("hiders", useIsFocused());
}

/** Marks a sheet open for as long as it is mounted: the shared `Sheet` calls this. */
export function useSheetOpenFlag() {
  useCounted("sheets", true);
}
