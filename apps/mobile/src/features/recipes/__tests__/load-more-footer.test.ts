import {
  LOAD_MORE_FOOTER_HEIGHT,
  loadMoreFooterBox,
} from "@/features/recipes/utils/load-more-footer";
import { accessoryTop, tabListBottomInset } from "@/lib/tab-bar-placement";
import { describe, expect, it } from "vitest";

const SCREEN = 874;

/** Where the loader's centre and the accessory's top land, list at its end, last card 12 pt above its row's end. */
function place(homeIndicator: number, minimised: boolean, accessoryTopFromBottom: number) {
  const rowEnd = SCREEN - tabListBottomInset(homeIndicator) - LOAD_MORE_FOOTER_HEIGHT;
  const box = loadMoreFooterBox(homeIndicator, minimised);

  return {
    centre: rowEnd + box.top + box.height / 2,
    cardBottom: rowEnd - 12,
    accessoryTop: SCREEN - accessoryTopFromBottom,
  };
}

describe("the tab bar's geometry", () => {
  // Measured on an iPhone 17: the accessory's top is 76 pt up minimised and 139 pt expanded.
  it("places the accessory where the simulator measured it", () => {
    expect(accessoryTop(34, true)).toBe(76);
    expect(accessoryTop(34, false)).toBe(139);
  });

  it("ends a tab list a gap above the expanded accessory", () => {
    expect(tabListBottomInset(34)).toBe(139 + 24);
    expect(tabListBottomInset(0)).toBe(accessoryTop(0, false) + 24);
  });
});

describe("loadMoreFooterBox", () => {
  it("centres the loader between the last card and the minimised accessory", () => {
    const { centre, cardBottom, accessoryTop } = place(34, true, 76);

    expect(centre).toBe((cardBottom + accessoryTop) / 2);
  });

  it("centres it between the last card and the expanded accessory above the tab bar", () => {
    const { centre, cardBottom, accessoryTop } = place(34, false, 139);

    expect(centre).toBe((cardBottom + accessoryTop) / 2);
  });

  it("centres it with no home indicator, where both placements sit lower", () => {
    const minimised = place(0, true, 56);
    const expanded = place(0, false, 105);

    expect(minimised.centre).toBe((minimised.cardBottom + minimised.accessoryTop) / 2);
    expect(expanded.centre).toBe((expanded.cardBottom + expanded.accessoryTop) / 2);
  });

  it("never shrinks below the footer's own strip", () => {
    expect(loadMoreFooterBox(34, false).height).toBeGreaterThanOrEqual(LOAD_MORE_FOOTER_HEIGHT);
  });
});
