import { tabListBottomInset } from "@/components/tab-list-inset";
import {
  LOAD_MORE_FOOTER_HEIGHT,
  loadMoreFooterSpan,
  nextTabBarMinimised,
} from "@/features/recipes/utils/load-more-footer";
import { describe, expect, it } from "vitest";

const SCREEN = 874;

/** Where the loader's centre lands, and the accessory's top, with the list at its end. */
function place(safeBottom: number, minimised: boolean, accessoryOccupies: number) {
  const lastCardBottom = SCREEN - tabListBottomInset(safeBottom) - LOAD_MORE_FOOTER_HEIGHT;
  const span = loadMoreFooterSpan(safeBottom, minimised);

  return {
    centre: lastCardBottom + span / 2,
    accessoryTop: SCREEN - accessoryOccupies,
    lastCardBottom,
  };
}

describe("loadMoreFooterSpan", () => {
  it("centres the loader between the last card and the minimised accessory (76 pt up on a 34 pt home indicator)", () => {
    const { centre, accessoryTop, lastCardBottom } = place(34, true, 76);

    expect(centre).toBe((lastCardBottom + accessoryTop) / 2);
    expect(loadMoreFooterSpan(34, true)).toBe(143);
  });

  it("centres it with no home indicator too, where the accessory sits lower", () => {
    const { centre, accessoryTop, lastCardBottom } = place(0, true, 56);

    expect(centre).toBe((lastCardBottom + accessoryTop) / 2);
  });

  it("keeps the strip above the clearance when the bar is expanded", () => {
    expect(loadMoreFooterSpan(34, false)).toBe(LOAD_MORE_FOOTER_HEIGHT);
    expect(loadMoreFooterSpan(0, false)).toBe(LOAD_MORE_FOOTER_HEIGHT);
  });
});

describe("nextTabBarMinimised", () => {
  it("minimises on a scroll down away from the top and expands on a scroll up or at the top", () => {
    expect(nextTabBarMinimised(false, 120, 100)).toBe(true);
    expect(nextTabBarMinimised(true, 100, 120)).toBe(false);
    expect(nextTabBarMinimised(true, 0, 4)).toBe(false);
  });

  it("holds while the offset does not move", () => {
    expect(nextTabBarMinimised(true, 120, 120)).toBe(true);
    expect(nextTabBarMinimised(false, 120, 120)).toBe(false);
  });
});
