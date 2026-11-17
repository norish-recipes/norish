import { useEffect, useSyncExternalStore } from "react";
import { useIsFocused } from "expo-router";

/** A mounted-count with its subscribers: the tab bar hides on either. */
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

/** Counts the caller in `store` while `active`. */
function useCounted(store: ReturnType<typeof counterStore>, active: boolean) {
  useEffect(() => {
    if (!active) return;

    store.change(1);

    return () => store.change(-1);
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
