import type { NativeStackNavigationProp } from "expo-router/native-stack";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { useNavigation } from "expo-router";

let shown: string | null = null;
const listeners = new Set<() => void>();

function show(id: string | null) {
  shown = id;
  listeners.forEach((listener) => listener());
}

/** The recipe whose page is on screen, from the start of its slide in to the start of its slide out. */
export const useShownRecipe = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => void listeners.delete(listener);
    },
    () => shown
  );

/** Marks recipe `id` shown on its screen's `transitionStart`, which UIKit's viewWillAppear and
 * viewWillDisappear send as the native slide begins, later than the route changes. */
export function useMarkRecipeShown(id: string) {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();

  useLayoutEffect(() => {
    const stops = [
      navigation.addListener("transitionStart", ({ data }) => {
        if (!data.closing) show(id);
        else if (shown === id) show(null);
      }),
      navigation.addListener("gestureCancel", () => show(id)),
    ];

    return () => {
      stops.forEach((stop) => stop());
      if (shown === id) show(null);
    };
  }, [navigation, id]);
}
