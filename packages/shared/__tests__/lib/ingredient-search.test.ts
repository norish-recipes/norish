import { describe, expect, it } from "vitest";

import { parseIngredientSearch } from "../../src/lib/ingredient-search";

describe("parseIngredientSearch", () => {
  it("reads a plain text as a word start, folded", () => {
    expect(parseIngredientSearch(" Crème ")).toEqual({
      kind: "like",
      patterns: ["creme%", "% creme%"],
    });
  });

  it("reads <name> as exactly that name", () => {
    expect(parseIngredientSearch("<Cola>")).toEqual({ kind: "exact", fold: "cola" });
  });

  it("reads % as anything, wherever it stands", () => {
    expect(parseIngredientSearch("%cola%")).toEqual({ kind: "like", patterns: ["%cola%"] });
    expect(parseIngredientSearch("cola%")).toEqual({ kind: "like", patterns: ["cola%"] });
    expect(parseIngredientSearch("%cola")).toEqual({ kind: "like", patterns: ["%cola"] });
  });

  it("folds each part of a pattern as a spelling is folded", () => {
    expect(parseIngredientSearch("Crème%Fraîche")).toEqual({
      kind: "like",
      patterns: ["creme%fraiche"],
    });
  });

  it("asks nothing of an empty search", () => {
    expect(parseIngredientSearch("  ")).toBeNull();
    expect(parseIngredientSearch("%")).toBeNull();
    expect(parseIngredientSearch("<>")).toBeNull();
  });
});
