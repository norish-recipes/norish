import { useEffect, useState } from "react";
import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useIsFocused } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";

import { nextTabBarMinimised } from "./tab-bar-placement";
import { homeIndicator } from "./use-tab-bar-minimised";

/** A tab's list scroll, wired once: `onScroll` goes on the list, `offset` (points scrolled past the
 * rest under the bar, on the UI thread) drives the title, and `minimised` is the tab bar's guess. */
export function useTabScroll() {
  const barHeight = useHeaderHeight();
  const offset = useSharedValue(0);
  const guess = useSharedValue(false);
  const lastOffset = useSharedValue(0);
  const [minimised, setMinimised] = useState(false);
  const focused = useIsFocused();
  const [wasFocused, setWasFocused] = useState(focused);

  // A tab coming back, from another tab or a screen over it, shows the bar expanded.
  if (focused !== wasFocused) {
    setWasFocused(focused);
    if (focused) setMinimised(false);
  }
  useEffect(() => {
    if (focused) guess.set(false);
  }, [focused, guess]);

  // The guess is made on the UI thread; JS hears only a flip, through the stable state setter.
  const onScroll = useAnimatedScrollHandler((event) => {
    const y = event.contentOffset.y;
    const next = nextTabBarMinimised(
      guess.get(),
      y,
      lastOffset.get(),
      event.contentSize.height - event.layoutMeasurement.height
    );

    // An automatic inset rests the list at minus the bar's height.
    offset.set(y + barHeight);
    lastOffset.set(y);
    if (next !== guess.get()) {
      guess.set(next);
      scheduleOnRN(setMinimised, next);
    }
  });

  return { offset, onScroll, minimised, homeIndicator };
}

export type TabScroll = ReturnType<typeof useTabScroll>;
