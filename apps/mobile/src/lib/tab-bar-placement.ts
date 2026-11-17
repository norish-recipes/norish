/** The tab bar's geometry in points, as measured on an iPhone 17 (ticket 38): the accessory's top
 * 76 pt up minimised and 139 pt expanded, over a 34 pt home indicator. */
const ACCESSORY_HEIGHT = 48;
/** Minimised, the accessory sits inline, 6 pt into the home indicator (8 pt off the edge without one). */
const MINIMISED_MIN_BOTTOM = 8;
const MINIMISED_INDICATOR_OVERLAP = 6;
/** Expanded, it sits 7 pt over the 50 pt tab bar, itself over the home indicator. */
const TAB_BAR_HEIGHT = 50;
const TAB_BAR_ACCESSORY_GAP = 7;
/** Between a tab list's last row and the expanded accessory. */
const LIST_END_GAP = 24;

/** How far up from the screen's bottom the accessory's top sits. */
export function accessoryTop(homeIndicator: number, minimised: boolean) {
  const bottom = minimised
    ? Math.max(homeIndicator - MINIMISED_INDICATOR_OVERLAP, MINIMISED_MIN_BOTTOM)
    : homeIndicator + TAB_BAR_HEIGHT + TAB_BAR_ACCESSORY_GAP;

  return bottom + ACCESSORY_HEIGHT;
}

// ponytail: both accessory placements mount at once, so JS can't read the bar's state: scroll direction guesses it, and tab lists keep the expanded end inset.
/** The padding that ends a tab's list above the tab bar and its accessory. */
export function tabListBottomInset(homeIndicator: number) {
  return accessoryTop(homeIndicator, false) + LIST_END_GAP;
}

/** Whether the tab bar is minimised after a scroll from `previous` to `offset`: a scroll down
 * minimises it and a scroll up expands it, as `onScrollDown` does; a bounce past either end holds. */
export function nextTabBarMinimised(
  current: boolean,
  offset: number,
  previous: number,
  maxOffset: number
) {
  "worklet";
  const inRange = (value: number) => value >= 0 && value <= maxOffset;

  if (!inRange(offset) || !inRange(previous) || offset === previous) return current;

  return offset > previous;
}
