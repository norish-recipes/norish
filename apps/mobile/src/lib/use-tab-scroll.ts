import { useEffect, useState } from "react";
import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { useIsFocused } from "expo-router";

import { nextTabBarMinimised } from "./tab-bar-placement";
import { homeIndicator } from "./use-tab-bar-minimised";

/** The native bar's height under the status bar (54 pt on an iPhone, the only device the app
 * runs on): fixed, as the measured header height arrives a few renders late. */
const BAR_HEIGHT = 54;

/** A tab's list scroll, wired once: `onScroll` goes on the list, `offset` (points scrolled past the
 * rest under the bar, on the UI thread) drives the title, and `minimised` is the tab bar's guess. */
export function useTabScroll() {
  const barBottom = useSafeAreaInsets().top + BAR_HEIGHT;
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

    // An automatic inset rests the list at minus the bar's bottom.
    offset.set(y + barBottom);
    lastOffset.set(y);
    if (next !== guess.get()) {
      guess.set(next);
      scheduleOnRN(setMinimised, next);
    }
  });

  return { offset, onScroll, minimised, homeIndicator, barBottom };
}

export type TabScroll = ReturnType<typeof useTabScroll>;
