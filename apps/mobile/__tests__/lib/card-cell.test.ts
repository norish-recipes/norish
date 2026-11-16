import { cardCell, GRID_CARD_HEIGHT } from "@/features/recipes/utils/card-cell";
import { describe, expect, it } from "vitest";

describe("cardCell", () => {
  it("is a full-width row in the list", () => {
    expect(cardCell(false, 3)).toEqual({ paddingHorizontal: 20, paddingBottom: 12 });
  });

  it("puts a grid's even cards left and its odd ones right, in the line of the card before", () => {
    const left = cardCell(true, 2);
    const right = cardCell(true, 3);

    expect(left.marginTop).toBe(0);
    expect(right.marginLeft).toBe("50%");
    expect(right.marginTop).toBe(-(GRID_CARD_HEIGHT + 12));
  });
});
