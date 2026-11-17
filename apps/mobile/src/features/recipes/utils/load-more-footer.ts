/** The load-more footer's own height in the list, above the end padding for the tab bar. */
export const LOAD_MORE_FOOTER_HEIGHT = 64;
/** A card row's bottom padding: the card ends this far above its row. */
const CARD_ROW_GAP = 12;
/** The tab bar's compact placement, the only one the system draws with the accessory: 48 pt tall,
 * 6 pt under the home indicator, 8 pt off the edge without one. */
const ACCESSORY_HEIGHT = 48;
const ACCESSORY_MIN_BOTTOM = 8;
const ACCESSORY_INDICATOR_OVERLAP = 6;

/** The box the loader centres in, from the last card's bottom edge down to the accessory's top:
 * `listInset` is the list's end padding, `homeIndicator` the window's bottom safe area. */
export function loadMoreFooterBox(listInset: number, homeIndicator: number) {
  const bottom = Math.max(homeIndicator - ACCESSORY_INDICATOR_OVERLAP, ACCESSORY_MIN_BOTTOM);
  const clearance = Math.max(listInset - bottom - ACCESSORY_HEIGHT, 0);

  return {
    top: -CARD_ROW_GAP,
    height: CARD_ROW_GAP + LOAD_MORE_FOOTER_HEIGHT + clearance,
  };
}
