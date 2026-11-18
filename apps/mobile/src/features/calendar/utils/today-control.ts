import { accessoryTop, TAB_BAR_ACCESSORY_GAP } from "@/lib/tab-bar-placement";

/** Where the Search button ends, from the screen's right edge, as measured on an iPhone 17. */
const SEARCH_END = { minimised: 28, expanded: 21 };

/** Where the Today control sits: above the accessory by the gap the tab bar keeps under it, its
 * right edge on the Search button's. */
export function todayControlPlace(homeIndicator: number, minimised: boolean) {
  return {
    right: minimised ? SEARCH_END.minimised : SEARCH_END.expanded,
    bottom: accessoryTop(homeIndicator, minimised) + TAB_BAR_ACCESSORY_GAP,
  };
}

/** Which way today lies from the days on screen, or null where its card is shown (or unknown):
 * the rule that says when the Today control appears. */
export function todayDirection(
  shownDays: readonly string[],
  todayKey: string,
  todayInRows: boolean
): "up" | "down" | null {
  if (!todayInRows || shownDays.length === 0 || shownDays.includes(todayKey)) return null;

  return (shownDays[0] ?? "") > todayKey ? "up" : "down";
}
