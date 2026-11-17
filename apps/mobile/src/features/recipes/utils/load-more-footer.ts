import { accessoryTop } from "@/lib/tab-bar-placement";

/** The load-more footer's own height in the list, above the end padding for the tab bar. */
export const LOAD_MORE_FOOTER_HEIGHT = 64;
/** A card row's bottom padding: the card ends this far above its row. */
const CARD_ROW_GAP = 12;

/** The box the loader centres in, from the last card's bottom edge down to the accessory's top:
 * `listInset` is the list's end padding, `homeIndicator` the window's bottom safe area. */
export function loadMoreFooterBox(listInset: number, homeIndicator: number, minimised: boolean) {
  const clearance = Math.max(listInset - accessoryTop(homeIndicator, minimised), 0);

  return {
    top: -CARD_ROW_GAP,
    height: CARD_ROW_GAP + LOAD_MORE_FOOTER_HEIGHT + clearance,
  };
}
