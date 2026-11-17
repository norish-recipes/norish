import {
  LOAD_MORE_FOOTER_HEIGHT,
  loadMoreFooterBox,
  nextTabBarMinimised,
} from "@/features/recipes/utils/load-more-footer";
import { describe, expect, it } from "vitest";

const SCREEN = 874;

/** Where the loader's centre and the accessory's top land, list at its end, last card 12 pt above its row's end. */
function place(
  listInset: number,
  homeIndicator: number,
  minimised: boolean,
  accessoryTopFromBottom: number
) {
  const rowEnd = SCREEN - listInset - LOAD_MORE_FOOTER_HEIGHT;
  const box = loadMoreFooterBox(listInset, homeIndicator, minimised);

  return {
    centre: rowEnd + box.top + box.height / 2,
    cardBottom: rowEnd - 12,
    accessoryTop: SCREEN - accessoryTopFromBottom,
  };
}

describe("loadMoreFooterBox", () => {
  // Measured on an iPhone 17: the accessory's top is 76 pt up minimised and 139 pt expanded, the
  // list's end padding 206 pt.
  it("centres the loader between the last card and the minimised accessory", () => {
    const { centre, cardBottom, accessoryTop } = place(206, 34, true, 76);

    expect(centre).toBe((cardBottom + accessoryTop) / 2);
  });

  it("centres it between the last card and the expanded accessory above the tab bar", () => {
    const { centre, cardBottom, accessoryTop } = place(206, 34, false, 139);

    expect(centre).toBe((cardBottom + accessoryTop) / 2);
  });

  it("centres it with no home indicator, where both placements sit lower", () => {
    const minimised = place(121, 0, true, 56);
    const expanded = place(121, 0, false, 105);

    expect(minimised.centre).toBe((minimised.cardBottom + minimised.accessoryTop) / 2);
    expect(expanded.centre).toBe((expanded.cardBottom + expanded.accessoryTop) / 2);
  });

  it("never shrinks below the footer's own strip", () => {
    expect(loadMoreFooterBox(0, 34, true).height).toBeGreaterThanOrEqual(LOAD_MORE_FOOTER_HEIGHT);
  });
});

describe("nextTabBarMinimised", () => {
  it("minimises on a scroll down and expands on a scroll up", () => {
    expect(nextTabBarMinimised(false, 120, 100, 900)).toBe(true);
    expect(nextTabBarMinimised(true, 100, 120, 900)).toBe(false);
  });

  it("holds while the offset does not move, and through a bounce past either end", () => {
    expect(nextTabBarMinimised(true, 120, 120, 900)).toBe(true);
    expect(nextTabBarMinimised(true, 898, 905, 900)).toBe(true);
    expect(nextTabBarMinimised(false, 905, 900, 900)).toBe(false);
    expect(nextTabBarMinimised(true, -4, 0, 900)).toBe(true);
  });
});
