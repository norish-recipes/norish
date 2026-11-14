import { describe, expect, it } from "vitest";

import { ingredientRows, plainText, stepRows } from "../utils/recipe-rows";

describe("ingredientRows", () => {
  const lines = [
    { ingredientName: "salt", systemUsed: "metric", order: 2 },
    { ingredientName: "# Sauce", systemUsed: "metric", order: 1 },
    { ingredientName: "flour", systemUsed: "metric", order: 0 },
    { ingredientName: "cups", systemUsed: "us", order: 0 },
  ];

  it("orders the recipe's own system and indexes only real lines", () => {
    const rows = ingredientRows(lines, "metric");

    expect(rows.map((row) => row.kind)).toEqual(["line", "heading", "line"]);
    expect(rows.map((row) => (row.kind === "line" ? row.index : row.text))).toEqual([
      0,
      "Sauce",
      1,
    ]);
  });
});

describe("stepRows", () => {
  it("numbers steps and leaves headings unnumbered", () => {
    const rows = stepRows(
      [
        { step: "Chop", systemUsed: "metric", order: 0 },
        { step: "## Cook", systemUsed: "metric", order: 1 },
        { step: "Fry", systemUsed: "metric", order: 2 },
      ],
      "metric"
    );

    expect(rows.map((row) => (row.kind === "step" ? row.number : row.text))).toEqual([
      1,
      "Cook",
      2,
    ]);
  });
});

describe("plainText", () => {
  it("drops markdown marks and keeps link labels", () => {
    expect(plainText("**Mix** the [flour](http://x.y) _well_")).toBe("Mix the flour well");
  });
});
