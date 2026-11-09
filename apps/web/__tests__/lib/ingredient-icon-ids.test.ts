import { iconIds } from "@/lib/ingredient-icon-ids";
import { describe, expect, it } from "vitest";

describe("iconIds", () => {
  it("asks about each food once, in one order, however a surface lists them", () => {
    expect(iconIds(["b", null, "a", undefined, "b", ""])).toEqual(["a", "b"]);
    expect(iconIds(["a", "b"])).toEqual(iconIds(["b", "a", "a"]));
  });

  it("asks about no more foods than the read takes", () => {
    const ids = Array.from({ length: 600 }, (_, n) => String(n).padStart(3, "0"));

    expect(iconIds(ids)).toHaveLength(500);
  });
});
