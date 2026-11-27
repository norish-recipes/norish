import { describe, expect, it } from "vitest";

import { olderThanHeld } from "./version-order";

describe("olderThanHeld", () => {
  it("is true only for a version below the one held", () => {
    expect(olderThanHeld(2, undefined)).toBe(false);
    expect(olderThanHeld(2, 1)).toBe(false);
    expect(olderThanHeld(2, 2)).toBe(false);
    expect(olderThanHeld(2, 3)).toBe(true);
  });

  it("counts a held copy with no version, persisted before versions, as older", () => {
    expect(olderThanHeld(1, undefined)).toBe(false);
  });
});
