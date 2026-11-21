import { describe, expect, it } from "vitest";

import { ingredientRows, stepRows } from "../utils/recipe-rows";

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

describe("ingredientRows foodId", () => {
  it("is the line's food, none for a line that names no food", () => {
    const rows = ingredientRows(
      [
        { ingredientName: "flour", ingredientId: "f1", systemUsed: "metric", order: 0 },
        { ingredientName: "2", ingredientId: "f2", systemUsed: "metric", order: 1 },
        { ingredientName: "water", systemUsed: "metric", order: 2 },
      ],
      "metric"
    );

    expect(rows.map((row) => (row.kind === "line" ? row.foodId : "heading"))).toEqual([
      "f1",
      null,
      null,
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
