import { describe, expect, it } from "vitest";

import { highlightSegments, matchLine } from "../utils/match-line";

describe("highlightSegments", () => {
  it("marks the term wherever it starts a word, ignoring case", () => {
    expect(highlightSegments("Hoisin Chicken and chicken stock", "chicken")).toEqual([
      { text: "Hoisin ", highlighted: false },
      { text: "Chicken", highlighted: true },
      { text: " and ", highlighted: false },
      { text: "chicken", highlighted: true },
      { text: " stock", highlighted: false },
    ]);
  });

  it("matches a prefix, not the middle of a word", () => {
    expect(highlightSegments("Chickpea curry", "chick")).toEqual([
      { text: "Chick", highlighted: true },
      { text: "pea curry", highlighted: false },
    ]);
    expect(highlightSegments("Hen", "en")).toEqual([{ text: "Hen", highlighted: false }]);
  });

  it("ignores accents in both and keeps the text as written", () => {
    expect(highlightSegments("Crème brûlée", "creme brulee")).toEqual([
      { text: "Crème", highlighted: true },
      { text: " ", highlighted: false },
      { text: "brûlée", highlighted: true },
    ]);
    expect(highlightSegments("creme", "Crème")).toEqual([{ text: "creme", highlighted: true }]);
  });

  it("merges overlapping terms", () => {
    expect(highlightSegments("chicken", "chick chicken")).toEqual([
      { text: "chicken", highlighted: true },
    ]);
  });

  it("leaves the text whole when no term is found literally", () => {
    expect(highlightSegments("Roasted potato", "potatoes")).toEqual([
      { text: "Roasted potato", highlighted: false },
    ]);
  });

  it("drops tsquery characters from terms", () => {
    expect(highlightSegments("Soup", "(soup:*)")).toEqual([{ text: "Soup", highlighted: true }]);
  });
});

describe("matchLine", () => {
  it("says 'In the title' with no text", () => {
    expect(matchLine({ field: "title" }, "soup")).toEqual({
      labelId: "recipes.search.matchTitle",
      segments: [],
    });
  });

  it("labels a tag and an ingredient and highlights the hit", () => {
    expect(matchLine({ field: "tags", text: "Soup" }, "soup")).toEqual({
      labelId: "recipes.search.matchTag",
      segments: [{ text: "Soup", highlighted: true }],
    });
    expect(matchLine({ field: "ingredients", text: "chicken stock" }, "chicken")).toEqual({
      labelId: "recipes.search.matchIngredient",
      segments: [
        { text: "chicken", highlighted: true },
        { text: " stock", highlighted: false },
      ],
    });
  });

  it("numbers a step", () => {
    expect(matchLine({ field: "steps", step: 3, text: "Pound the basil" }, "basil")).toMatchObject({
      labelId: "recipes.search.matchStep",
      labelValues: { number: 3 },
    });
  });

  it("shows a description snippet without a label", () => {
    expect(matchLine({ field: "description", text: "fresh basil" }, "basil").labelId).toBeNull();
  });
});
