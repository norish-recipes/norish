import { useEffect, useSyncExternalStore } from "react";
import { useIsFocused } from "expo-router";

/** A mounted-count with its subscribers: the tab bar hides on one count, the page's bottom bar on the other. */
const counterStore = () => {
  let count = 0;
  const listeners = new Set<() => void>();

  return {
    count: () => count,
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => void listeners.delete(listener);
    },
    change: (by: number) => {
      count += by;
      listeners.forEach((listener) => listener());
    },
  };
};

const hiders = counterStore();
const sheets = counterStore();

/** Whether the tab bar goes: a screen with its own chrome is in front, or a sheet is open. */
export const useTabBarHidden = () =>
  useSyncExternalStore(
    (listener) => {
      const stops = [hiders.subscribe(listener), sheets.subscribe(listener)];

      return () => stops.forEach((stop) => stop());
    },
    () => hiders.count() + sheets.count() > 0
  );

/** Whether a sheet is over the page: its glass shows what is under it, such as a page's bottom bar. */
export const useSheetOpen = () => useSyncExternalStore(sheets.subscribe, () => sheets.count() > 0);

/** Counts the caller in `store` while `active`. */
function useCounted(store: ReturnType<typeof counterStore>, active: boolean) {
  useEffect(() => {
    if (!active) return;

    store.change(1);

    return () => store.change(-1);
  }, [store, active]);
}

/** Hides the tab bar while the calling screen is mounted and in front: the recipe page, which has its own chrome. */
export function useHideTabBar() {
  useCounted(hiders, useIsFocused());
}

/** Marks a sheet open for as long as it is mounted: the shared `Sheet` calls this. */
export function useMarkSheetOpen() {
  useCounted(sheets, true);
}
