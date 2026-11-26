import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { initialWindowMetrics } from "react-native-safe-area-context";

/** The native bar's height under the status bar (54 pt on an iPhone, the only device the app
 * runs on): fixed, as the measured header height arrives a few renders late. */
const BAR_HEIGHT = 54;

/** Where the bar ends, from the window's inset: a screen's measured one reads 0 on its first
 * frame, and an offset taken then drops the Groceries switch by the status bar's height. */
const BAR_BOTTOM = (initialWindowMetrics?.insets.top ?? 0) + BAR_HEIGHT;

/** A tab's list scroll, wired once: `onScroll` goes on a ScrollView (`CardList` sets `offset` from its
 * own), and `offset` (points scrolled past the rest under the bar, on the UI thread) drives the title. */
export function useTabScroll() {
  const barBottom = BAR_BOTTOM;
  const offset = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    // An automatic inset rests the list at minus the bar's bottom.
    offset.set(event.contentOffset.y + barBottom);
  });

  return { offset, onScroll, barBottom };
}

export type TabScroll = ReturnType<typeof useTabScroll>;
