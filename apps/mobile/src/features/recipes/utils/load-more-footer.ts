/** The load-more footer's own height in the list, above the end padding for the tab bar. */
export const LOAD_MORE_FOOTER_HEIGHT = 64;
/** A card row's bottom padding: the card ends this far above its row. */
const CARD_ROW_GAP = 12;
/** The accessory is 48 pt tall. Minimised it sits inline, 6 pt under the home indicator (8 pt off
 * the edge without one); expanded it sits 7 pt over the 50 pt tab bar, itself over the indicator. */
const ACCESSORY_HEIGHT = 48;
const MINIMISED_MIN_BOTTOM = 8;
const MINIMISED_INDICATOR_OVERLAP = 6;
const TAB_BAR_HEIGHT = 50;
const TAB_BAR_ACCESSORY_GAP = 7;

/** How far up from the screen's bottom the accessory's top sits. */
function accessoryTop(homeIndicator: number, minimised: boolean) {
  const bottom = minimised
    ? Math.max(homeIndicator - MINIMISED_INDICATOR_OVERLAP, MINIMISED_MIN_BOTTOM)
    : homeIndicator + TAB_BAR_HEIGHT + TAB_BAR_ACCESSORY_GAP;

  return bottom + ACCESSORY_HEIGHT;
}

/** The box the loader centres in, from the last card's bottom edge down to the accessory's top:
 * `listInset` is the list's end padding, `homeIndicator` the window's bottom safe area. */
export function loadMoreFooterBox(listInset: number, homeIndicator: number, minimised: boolean) {
  const clearance = Math.max(listInset - accessoryTop(homeIndicator, minimised), 0);

  return {
    top: -CARD_ROW_GAP,
    height: CARD_ROW_GAP + LOAD_MORE_FOOTER_HEIGHT + clearance,
  };
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
