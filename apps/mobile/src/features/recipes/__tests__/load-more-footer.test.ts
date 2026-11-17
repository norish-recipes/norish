import {
  LOAD_MORE_FOOTER_HEIGHT,
  loadMoreFooterBox,
} from "@/features/recipes/utils/load-more-footer";
import { describe, expect, it } from "vitest";

const SCREEN = 874;

/** Where the loader's centre and the accessory's top land, list at its end, last card 12 pt above its row's end. */
function place(listInset: number, homeIndicator: number, accessoryTopFromBottom: number) {
  const rowEnd = SCREEN - listInset - LOAD_MORE_FOOTER_HEIGHT;
  const box = loadMoreFooterBox(listInset, homeIndicator);

  return {
    centre: rowEnd + box.top + box.height / 2,
    cardBottom: rowEnd - 12,
    accessoryTop: SCREEN - accessoryTopFromBottom,
  };
}

describe("loadMoreFooterBox", () => {
  it("centres the loader between the last card and the accessory on a phone with a home indicator", () => {
    // Measured on an iPhone 17: the accessory's top is 76 pt up, the list's end padding 206 pt.
    const { centre, cardBottom, accessoryTop } = place(206, 34, 76);

    expect(centre).toBe((cardBottom + accessoryTop) / 2);
  });

  it("centres it with no home indicator, where the accessory sits lower", () => {
    const { centre, cardBottom, accessoryTop } = place(121, 0, 56);

    expect(centre).toBe((cardBottom + accessoryTop) / 2);
  });

  it("never shrinks below the footer's own strip", () => {
    expect(loadMoreFooterBox(0, 34).height).toBeGreaterThanOrEqual(LOAD_MORE_FOOTER_HEIGHT);
  });
});
