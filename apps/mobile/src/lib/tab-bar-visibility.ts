import { useEffect, useSyncExternalStore } from "react";

let hiders = 0;
const listeners = new Set<() => void>();

const change = (by: number) => {
  hiders += by;
  listeners.forEach((listener) => listener());
};

/** Whether a screen over the tabs asked for the tab bar to go: the recipe page, which has its own chrome. */
export function useTabBarHidden(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => void listeners.delete(listener);
    },
    () => hiders > 0
  );
}

/** Hides the tab bar for as long as the calling screen is mounted. */
export function useHideTabBar() {
  useEffect(() => {
    change(1);

    return () => change(-1);
  }, []);
}
