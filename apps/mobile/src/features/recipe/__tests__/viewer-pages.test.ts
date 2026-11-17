import { describe, expect, it } from "vitest";

import { counterLabel, dismisses, pageAt } from "../utils/viewer-pages";

describe("pageAt", () => {
  it("rounds an offset to the nearest page", () => {
    expect(pageAt(0, 400, 3)).toBe(0);
    expect(pageAt(190, 400, 3)).toBe(0);
    expect(pageAt(210, 400, 3)).toBe(1);
    expect(pageAt(800, 400, 3)).toBe(2);
  });

  it("clamps a bounce past either end and an unmeasured width", () => {
    expect(pageAt(-60, 400, 3)).toBe(0);
    expect(pageAt(1000, 400, 3)).toBe(2);
    expect(pageAt(400, 0, 3)).toBe(0);
  });
});

describe("counterLabel", () => {
  it("counts from one", () => {
    expect(counterLabel(0, 5)).toBe("1 / 5");
    expect(counterLabel(4, 5)).toBe("5 / 5");
  });
});

describe("dismisses", () => {
  it("lets go after a long drag down or a fast flick down", () => {
    expect(dismisses(160, 0)).toBe(true);
    expect(dismisses(20, 1200)).toBe(true);
  });

  it("holds after a short slow drag, and for any drag up", () => {
    expect(dismisses(60, 200)).toBe(false);
    expect(dismisses(-300, -1500)).toBe(false);
  });
});
