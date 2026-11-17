/** The tab bar's accessory floats over a list's end, so the last row scrolls clear of it. */
const ACCESSORY_CLEARANCE = 72;
/** UIKit no longer insets the list for the tab bar, so its full height is added here. */
// ponytail: both accessory placements mount at once, so JS cannot tell the bar's state; 49 pt extra at the end when minimised.
const TAB_BAR_HEIGHT = 49;

/** The padding that ends a tab's list above the tab bar and its accessory. */
export function tabListBottomInset(safeAreaBottom: number): number {
  return safeAreaBottom + TAB_BAR_HEIGHT + ACCESSORY_CLEARANCE;
}
