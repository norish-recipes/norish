import type { NativeStackNavigationProp } from "expo-router/native-stack";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { useNavigation, useRoute } from "expo-router";

let shown: { key: string; id: string } | null = null;
const listeners = new Set<() => void>();

function show(next: { key: string; id: string } | null) {
  shown = next;
  listeners.forEach((listener) => listener());
}

/** The recipe whose page is on screen, from the start of its slide in to the start of its slide out. */
export const useShownRecipe = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => void listeners.delete(listener);
    },
    () => shown?.id ?? null
  );

/** Marks recipe `id` shown on its screen's `transitionStart` (UIKit's viewWill(Dis)appear, as the
 * slide begins), keyed by the route: one recipe can be in the stack twice. */
export function useMarkRecipeShown(id: string) {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const { key } = useRoute();

  useLayoutEffect(() => {
    const clear = () => shown?.key === key && show(null);
    const stops = [
      navigation.addListener("transitionStart", ({ data }) =>
        data.closing ? clear() : show({ key, id })
      ),
      navigation.addListener("gestureCancel", () => show({ key, id })),
    ];

    return () => {
      stops.forEach((stop) => stop());
      clear();
    };
  }, [navigation, key, id]);
}
