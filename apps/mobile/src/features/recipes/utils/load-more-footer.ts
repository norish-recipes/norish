import { tabListBottomInset } from "@/components/tab-list-inset";

/** The load-more footer's own height in the list, above the clearance for the tab bar. */
export const LOAD_MORE_FOOTER_HEIGHT = 64;
/** The minimised accessory is 48 pt tall and floats 6 pt under the home indicator, 8 pt off the edge without one. */
const MINIMISED_ACCESSORY_HEIGHT = 48;
const MINIMISED_ACCESSORY_MIN_BOTTOM = 8;
const MINIMISED_ACCESSORY_OVERLAP = 6;

/** How far the list ends above the minimised accessory's top: the clearance minus what it covers. */
function minimisedSlack(safeBottom: number) {
  const bottom = Math.max(safeBottom - MINIMISED_ACCESSORY_OVERLAP, MINIMISED_ACCESSORY_MIN_BOTTOM);

  return Math.max(tabListBottomInset(safeBottom) - bottom - MINIMISED_ACCESSORY_HEIGHT, 0);
}

/** The height from the last card to the accessory's top, which the loader centres in; the
 * expanded bar's clearance is the footer's own strip, the minimised one sits lower. */
export function loadMoreFooterSpan(safeBottom: number, minimised: boolean) {
  return LOAD_MORE_FOOTER_HEIGHT + (minimised ? minimisedSlack(safeBottom) : 0);
}

/** The tab bar after a scroll to `offset` from `previous`: minimised scrolling down, expanded
 * scrolling up or back at the top, as `onScrollDown` does. */
export function nextTabBarMinimised(current: boolean, offset: number, previous: number) {
  if (offset <= 8) return false;
  if (offset === previous) return current;

  return offset > previous;
}
