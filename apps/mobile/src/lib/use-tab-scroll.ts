import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { homeIndicator } from "./home-indicator";

/** The native bar's height under the status bar (54 pt on an iPhone, the only device the app
 * runs on): fixed, as the measured header height arrives a few renders late. */
const BAR_HEIGHT = 54;

/** A tab's list scroll, wired once: `onScroll` goes on the list, and `offset` (points scrolled past
 * the rest under the bar, on the UI thread) drives the title; `homeIndicator` is the safe area the tab bar sits over. */
export function useTabScroll() {
  const barBottom = useSafeAreaInsets().top + BAR_HEIGHT;
  const offset = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    // An automatic inset rests the list at minus the bar's bottom.
    offset.set(event.contentOffset.y + barBottom);
  });

  return { offset, onScroll, homeIndicator, barBottom };
}

export type TabScroll = ReturnType<typeof useTabScroll>;
