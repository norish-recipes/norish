import { describe, expect, it } from "vitest";

import { nearestSlip, slipsNear } from "@norish/shared/lib/name-slips";

describe("slipsNear", () => {
  it("lists every thing one slip away, each by its first name", () => {
    const near = slipsNear(
      "sambal olek",
      ["sambal olie", "sambal oelek", "sambal oelekk", "sambal oleks"],
      (name) => name,
      (name) => name.slice(0, 10)
    );

    expect(near.map(({ item }) => item)).toEqual(["sambal oelek", "sambal oleks"]);
    expect(near[0]!.score).toBeLessThan(1);
  });

  it.each([
    ["knolook", "knoflook"],
    ["sneopjes", "snoepjes"],
    ["worchestershiresaus", "worcestershiresaus"],
    ["roodschillge krieltjes", "roodschillige krieltjes"],
    ["parmezan", "parmezaan"],
  ])("reads %s as %s typed with a slip", (wanted, name) => {
    expect(nearestSlip(wanted, [name], (item) => item)).toBe(name);
  });

  // Two letters apart, or the first letter changed, is another food as often as not.
  it.each([
    ["wraps", "raps"],
    ["plain flour", "lupin flour"],
    ["witte kaas", "witte mais"],
    ["visfilet", "kipfilet"],
    ["amandelmelk", "amandelmeel"],
    ["trassi", "grassi"],
    ["salt pepper", "sort pepper"],
    ["uncooked rice", "cooked rice"],
    ["melk", "meel"],
  ])("never reads %s as %s", (wanted, name) => {
    expect(nearestSlip(wanted, [name], (item) => item)).toBeNull();
  });

  it("leaves nearestSlip with no answer where two things tie", () => {
    expect(nearestSlip("chili sauce", ["chilli sauce", "chili sause"], (name) => name)).toBeNull();
    expect(nearestSlip("chili sauce", ["chilli sauce"], (name) => name)).toBe("chilli sauce");
  });
});
