import { describe, expect, it } from "vitest";

import { nearestSlip, slipsNear } from "@norish/shared/lib/name-slips";

describe("slipsNear", () => {
  const names = ["sambal olie", "sambal oelek", "sambal badjak", "sambal oeleks"];

  it("lists every thing a slip away, each by its nearest name, best first", () => {
    const near = slipsNear(
      "sambal olek",
      names,
      (name) => name,
      (name) => name.slice(0, 10)
    );

    expect(near.map(({ item }) => item)).toEqual(["sambal oelek", "sambal olie"]);
    expect(near[0]!.score).toBeGreaterThan(near[1]!.score);
    expect(near[1]!.score).toBeLessThan(1);
  });

  it("leaves nearestSlip with no answer where two things tie", () => {
    expect(nearestSlip("chili sauce", ["chilli sauce", "chili sause"], (name) => name)).toBeNull();
    expect(nearestSlip("chili sauce", ["chilli sauce"], (name) => name)).toBe("chilli sauce");
  });
});
