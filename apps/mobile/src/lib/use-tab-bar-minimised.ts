import { useRef, useState } from "react";
import { initialWindowMetrics } from "react-native-safe-area-context";
import { useIsFocused } from "expo-router";

import { nextTabBarMinimised } from "./tab-bar-placement";

/** The window's bottom safe area: the home indicator the tab bar sits over. */
export const homeIndicator = initialWindowMetrics?.insets.bottom ?? 0;

/** Whether the tab bar is minimised, guessed from the list's scroll: `track` takes each scroll event. */
export function useTabBarMinimised() {
  const [minimised, setMinimised] = useState(false);
  const lastOffsetRef = useRef(0);
  const focused = useIsFocused();
  const [wasFocused, setWasFocused] = useState(focused);

  // A tab coming back, from another tab or a screen over it, shows the bar expanded.
  if (focused !== wasFocused) {
    setWasFocused(focused);
    if (focused) setMinimised(false);
  }

  return {
    minimised,
    homeIndicator,
    track: (event: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    }) => {
      const offset = event.contentOffset.y;
      const maxOffset = event.contentSize.height - event.layoutMeasurement.height;

      setMinimised(nextTabBarMinimised(minimised, offset, lastOffsetRef.current, maxOffset));
      lastOffsetRef.current = offset;
    },
  };
}
