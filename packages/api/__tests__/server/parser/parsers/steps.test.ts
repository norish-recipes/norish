import { describe, expect, it } from "vitest";

import { withoutStepNumbers } from "@norish/api/parser/parsers/steps";

describe("withoutStepNumbers", () => {
  it("drops the count before each step", () => {
    expect(withoutStepNumbers(["Step 1", "Collect items", "Step 2", "Wash berries"])).toEqual([
      "Collect items",
      "Wash berries",
    ]);
  });

  it("reads a count in another language, or a bare number", () => {
    expect(withoutStepNumbers(["Schritt 1", "Mischen", "Schritt 2:", "Backen"])).toEqual([
      "Mischen",
      "Backen",
    ]);
    expect(withoutStepNumbers(["1", "Mix", "2", "Bake"])).toEqual(["Mix", "Bake"]);
  });

  it("keeps a list that does not alternate a running count with text", () => {
    const shortStep = ["Bake 350", "Let it cool"];
    const outOfOrder = ["Step 2", "Mix", "Step 1", "Bake"];
    const mixedWords = ["Step 1", "Mix", "Day 2", "Bake"];
    const unpaired = ["Step 1", "Mix", "Step 2"];

    expect(withoutStepNumbers(shortStep)).toEqual(shortStep);
    expect(withoutStepNumbers(outOfOrder)).toEqual(outOfOrder);
    expect(withoutStepNumbers(mixedWords)).toEqual(mixedWords);
    expect(withoutStepNumbers(unpaired)).toEqual(unpaired);
  });

  it("leaves an empty list and ordinary steps alone", () => {
    expect(withoutStepNumbers([])).toEqual([]);
    expect(withoutStepNumbers(["Mix", "Bake"])).toEqual(["Mix", "Bake"]);
  });
});
