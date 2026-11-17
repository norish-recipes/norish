import { useRef, useState } from "react";
import { initialWindowMetrics } from "react-native-safe-area-context";

import { nextTabBarMinimised } from "./tab-bar-placement";

/** Whether the tab bar is minimised, guessed from the list's scroll: `track` takes each scroll
 * event of the list, and `homeIndicator` is the window's bottom safe area. */
// ponytail: scroll direction guesses the bar; the accessory mounts both placements at once, so JS cannot read which shows.
export function useTabBarMinimised() {
  const [minimised, setMinimised] = useState(false);
  const lastOffsetRef = useRef(0);

  return {
    minimised,
    homeIndicator: initialWindowMetrics?.insets.bottom ?? 0,
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
