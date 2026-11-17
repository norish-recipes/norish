import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useHeaderHeight } from "expo-router/react-navigation";

import { useTabBarMinimised } from "./use-tab-bar-minimised";

/** A tab's list scroll, wired once: `onScroll` goes on the list, `offset` (points scrolled past the
 * rest under the bar, on the UI thread) drives the title, and `minimised` is the tab bar's guess. */
export function useTabScroll() {
  const barHeight = useHeaderHeight();
  const offset = useSharedValue(0);
  const { minimised, homeIndicator, track } = useTabBarMinimised();
  const onScroll = useAnimatedScrollHandler((event) => {
    // An automatic inset rests the list at minus the bar's height.
    offset.value = event.contentOffset.y + barHeight;
    scheduleOnRN(track, {
      contentOffset: { y: event.contentOffset.y },
      contentSize: { height: event.contentSize.height },
      layoutMeasurement: { height: event.layoutMeasurement.height },
    });
  });

  return { offset, onScroll, minimised, homeIndicator };
}

export type TabScroll = ReturnType<typeof useTabScroll>;
