import { describe, expect, it, vi } from "vitest";

import { highlightSegments, matchLine } from "../utils/match-line";

/** Runs `fn` with indexOf capped, so a scan that stops advancing fails instead of hanging. */
function bounded<T>(fn: () => T): T {
  const indexOf = String.prototype.indexOf;
  let calls = 0;
  const spy = vi.spyOn(String.prototype, "indexOf").mockImplementation(function (
    this: string,
    search: string,
    position?: number
  ) {
    if (++calls > 10_000) throw new Error("the highlighter stopped advancing");

    return indexOf.call(this, search, position);
  });

  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

describe("highlightSegments", () => {
  it("ends on terms that fold to nothing", { timeout: 1000 }, () => {
    expect(bounded(() => highlightSegments("Basil pesto", "basil ^"))).toEqual([
      { text: "Basil", highlighted: true },
      { text: " pesto", highlighted: false },
    ]);
    expect(bounded(() => highlightSegments("Basil pesto", "^ ` \u00b4"))).toEqual([
      { text: "Basil pesto", highlighted: false },
    ]);
    expect(bounded(() => highlightSegments("Basil pesto", ""))).toEqual([
      { text: "Basil pesto", highlighted: false },
    ]);
  });

  it("marks the words the server's any-word fallback found", () => {
    expect(highlightSegments("Chicken", "chicken,rice")).toEqual([
      { text: "Chicken", highlighted: true },
    ]);
    expect(highlightSegments("Fried rice", "chicken,rice")).toEqual([
      { text: "Fried ", highlighted: false },
      { text: "rice", highlighted: true },
    ]);
  });

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

  it("labels a tag and highlights the hit", () => {
    expect(matchLine({ field: "tags", tag: "Soup" }, "soup")).toEqual({
      labelId: "recipes.search.matchTag",
      segments: [{ text: "Soup", highlighted: true }],
    });
  });

  it("puts the formatted amount and unit before the ingredient, highlighting only its name", () => {
    expect(
      matchLine(
        { field: "ingredients", amount: 4, unit: "g", name: "chicken stock" },
        "chicken",
        "4 g"
      )
    ).toEqual({
      labelId: "recipes.search.matchIngredient",
      segments: [
        { text: "4 g ", highlighted: false },
        { text: "chicken", highlighted: true },
        { text: " stock", highlighted: false },
      ],
    });
  });

  it("numbers a step", () => {
    expect(
      matchLine({ field: "steps", number: 3, snippet: "Pound the basil" }, "basil")
    ).toMatchObject({ labelId: "recipes.search.matchStep", labelValues: { number: 3 } });
  });

  it("shows a step heading, which has no number, as a plain snippet", () => {
    expect(matchLine({ field: "steps", snippet: "The basil" }, "basil").labelId).toBeNull();
  });

  it("shows a description snippet without a label", () => {
    expect(matchLine({ field: "description", snippet: "fresh basil" }, "basil").labelId).toBeNull();
  });

  it("shows a snippet cut inside markdown without its markers", () => {
    const text = (snippet: string) =>
      matchLine({ field: "description", snippet }, "basil")
        .segments.map((segment) => segment.text)
        .join("");

    expect(text("Add **basil and stir")).toBe("Add basil and stir");
    expect(text("stir the basil__ well")).toBe("stir the basil well");
    expect(text("_fresh basil and the [best oil](http://exa")).toBe("fresh basil and the best oil");
    expect(text("# Pound *the basil")).toBe("Pound the basil");
    expect(text("a snake_case basil")).toBe("a snake_case basil");
  });

  it("shows snippets and ingredient names as plain text, without markdown", () => {
    const text = (segments: { text: string }[]) => segments.map((segment) => segment.text).join("");

    expect(
      text(
        matchLine(
          { field: "description", snippet: "**fresh** [basil](http://x.y) _leaves_" },
          "basil"
        ).segments
      )
    ).toBe("fresh basil leaves");
    expect(
      text(
        matchLine({ field: "steps", number: 1, snippet: "# Pound the **basil**" }, "basil").segments
      )
    ).toBe("Pound the basil");
    expect(
      text(
        matchLine({ field: "ingredients", amount: null, unit: null, name: "**basil**" }, "basil")
          .segments
      )
    ).toBe("basil");
  });
});
