import type { NativeStackNavigationProp } from "expo-router/native-stack";
import { useLayoutEffect } from "react";
import { createMark } from "@/lib/mark";
import { useNavigation, useRoute } from "expo-router";

// A mark, as the one tab bar and every recipe page live in separate trees; a page clears its own
// mark when it unmounts, so a mark never outlives the page that set it.
const shown = createMark<{ key: string; id: string } | null>(null);

/** The recipe whose page is on screen, from the start of its slide in to the start of its slide out. */
export const useShownRecipe = () => shown.use()?.id ?? null;

/** Marks recipe `id` shown on its screen's `transitionStart` (UIKit's viewWill(Dis)appear, as the
 * slide begins), keyed by the route: one recipe can be in the stack twice. */
export function useMarkRecipeShown(id: string) {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const { key } = useRoute();

  useLayoutEffect(
    () => () => shown.update((current) => (current?.key === key ? null : current)),
    [key]
  );

  useLayoutEffect(() => {
    // A link to another recipe while this page is on top gives its route the new id in place.
    shown.update((current) => (current?.key === key ? { key, id } : current));
    const stops = [
      navigation.addListener("transitionStart", ({ data }) =>
        shown.update((current) =>
          data.closing ? (current?.key === key ? null : current) : { key, id }
        )
      ),
      navigation.addListener("gestureCancel", () => shown.set({ key, id })),
    ];

    return () => stops.forEach((stop) => stop());
  }, [navigation, key, id]);
}
