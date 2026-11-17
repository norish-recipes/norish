import { stripIntent } from "@/features/recipes/utils/tag-strip-intent";
import { describe, expect, it } from "vitest";

describe("stripIntent", () => {
  it("waits until the finger has moved", () => {
    expect(stripIntent(3, 2, 0, 100)).toBe("wait");
  });

  it("scrolls a strip that can go the way the finger moves", () => {
    expect(stripIntent(-20, 2, 0, 100)).toBe("scroll");
    expect(stripIntent(20, 2, 40, 100)).toBe("scroll");
  });

  it("leaves a drag the strip cannot take to the card's swipe", () => {
    expect(stripIntent(-20, 2, 100, 100)).toBe("pass");
    expect(stripIntent(-20, 2, 0, 0)).toBe("pass");
    expect(stripIntent(20, 2, 0, 100)).toBe("pass");
  });

  it("leaves a vertical drag to the list", () => {
    expect(stripIntent(2, 30, 40, 100)).toBe("pass");
  });
});
