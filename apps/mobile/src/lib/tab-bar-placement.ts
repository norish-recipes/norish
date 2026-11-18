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

/** The padding that ends a tab's list above the tab bar and its accessory, expanded or not: an
 * end that followed the bar would shrink the list as the bar minimises there, and pull it back. */
export function tabListBottomInset(homeIndicator: number) {
  return accessoryTop(homeIndicator, false) + LIST_END_GAP;
}
