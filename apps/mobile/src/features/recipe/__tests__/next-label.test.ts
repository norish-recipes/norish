import { describe, expect, it } from "vitest";

import { NEXT_CHROME, nextLabelFits } from "../utils/next-label";

describe("nextLabelFits", () => {
  it("shows the label where it fits beside the chevron", () => {
    expect(nextLabelFits(160, 80)).toBe(true);
    expect(nextLabelFits(80 + NEXT_CHROME, 80)).toBe(true);
    expect(nextLabelFits(117, 74)).toBe(true);
  });

  it("drops it where a wide timer pill or a long word leaves too little room", () => {
    expect(nextLabelFits(82, 80)).toBe(false);
    expect(nextLabelFits(150, 140)).toBe(false);
  });

  it("shows it until both widths are measured", () => {
    expect(nextLabelFits(0, 80)).toBe(true);
    expect(nextLabelFits(82, 0)).toBe(true);
  });
});
