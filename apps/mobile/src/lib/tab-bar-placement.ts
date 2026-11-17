/** The accessory is 48 pt tall. Minimised it sits inline, 6 pt under the home indicator (8 pt off
 * the edge without one); expanded it sits 7 pt over the 50 pt tab bar, itself over the indicator. */
const ACCESSORY_HEIGHT = 48;
const MINIMISED_MIN_BOTTOM = 8;
const MINIMISED_INDICATOR_OVERLAP = 6;
const TAB_BAR_HEIGHT = 50;
const TAB_BAR_ACCESSORY_GAP = 7;

/** How far up from the screen's bottom the accessory's top sits. */
export function accessoryTop(homeIndicator: number, minimised: boolean) {
  const bottom = minimised
    ? Math.max(homeIndicator - MINIMISED_INDICATOR_OVERLAP, MINIMISED_MIN_BOTTOM)
    : homeIndicator + TAB_BAR_HEIGHT + TAB_BAR_ACCESSORY_GAP;

  return bottom + ACCESSORY_HEIGHT;
}

/** Whether the tab bar is minimised after a scroll from `previous` to `offset`: a scroll down
 * minimises it and a scroll up expands it, as `onScrollDown` does; a bounce past either end holds. */
export function nextTabBarMinimised(
  current: boolean,
  offset: number,
  previous: number,
  maxOffset: number
) {
  const inRange = (value: number) => value >= 0 && value <= maxOffset;

  if (!inRange(offset) || !inRange(previous) || offset === previous) return current;

  return offset > previous;
}
