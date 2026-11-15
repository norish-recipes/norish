import { useEffect, useSyncExternalStore } from "react";
import { useIsFocused, useNavigation, useRoute } from "expo-router";

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

/** Hides the tab bar for as long as the calling screen is mounted and in front, or has only the
 * named sheets of its stack over it while its tab is in front. */
export function useHideTabBar(sheets: readonly string[] = []) {
  const navigation = useNavigation();
  const route = useRoute();
  const focused = useIsFocused();
  const underSheet = useSyncExternalStore(
    (listener) => {
      const parent = navigation.getParent();
      const unsubscribes = [
        navigation.addListener("state", listener),
        parent?.addListener("focus", listener),
        parent?.addListener("blur", listener),
      ];

      return () => unsubscribes.forEach((unsubscribe) => unsubscribe?.());
    },
    () => {
      const routes = navigation.getState()?.routes ?? [];
      const above = routes.slice(routes.findIndex(({ key }) => key === route.key) + 1);

      return (
        above.length > 0 &&
        above.every(({ name }) => sheets.includes(name)) &&
        (navigation.getParent()?.isFocused() ?? true)
      );
    }
  );
  const hidden = focused || underSheet;

  useEffect(() => {
    if (!hidden) return;

    change(1);

    return () => change(-1);
  }, [hidden]);
}
