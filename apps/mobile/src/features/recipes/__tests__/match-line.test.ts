import { describe, expect, it } from "vitest";

import { matchLine } from "../utils/match-line";

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
