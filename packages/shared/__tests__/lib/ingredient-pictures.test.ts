import { describe, expect, it } from "vitest";

import {
  buildIngredientLookup,
  findIngredientForName,
  ingredientLineNamePart,
  replaceIngredientLineName,
  suggestIngredientNames,
} from "@norish/shared/lib/ingredient-pictures";

const flour = { id: "f", name: "Flour", imageUrl: "/f.webp" };
const coriander = { id: "c", name: "Coriander", imageUrl: null };
const egg = { id: "e", name: "Eggs", imageUrl: "/e.webp" };
const eggplant = { id: "p", name: "Aubergine", imageUrl: null };
const catalog = [flour, coriander, egg, eggplant];

describe("findIngredientForName", () => {
  const lookup = buildIngredientLookup(catalog);

  it("matches a name by the grocery folding, and nothing looser", () => {
    expect(findIngredientForName(lookup, "flour")).toBe(flour);
    expect(findIngredientForName(lookup, "  EGGS! ")).toBe(egg);
  });

  it("matches a name with no picture: a picture is not what makes a name known", () => {
    expect(findIngredientForName(lookup, "coriander")).toBe(coriander);
    expect(findIngredientForName(lookup, "aubergine")).toBe(eggplant);
  });

  it("never matches a longer or looser name", () => {
    expect(findIngredientForName(lookup, "free-range eggs")).toBeNull();
    expect(findIngredientForName(lookup, "plain flour")).toBeNull();
    expect(findIngredientForName(lookup, "flou")).toBeNull();
    expect(findIngredientForName(lookup, "")).toBeNull();
    expect(findIngredientForName(lookup, null)).toBeNull();
  });

  it("keeps the first entry when two names fold alike", () => {
    const other = { id: "x", name: "eggs!", imageUrl: "/x.webp" };
    const stale = buildIngredientLookup([egg, other]);

    expect(findIngredientForName(stale, "eggs")).toBe(egg);
  });
});

describe("suggestIngredientNames", () => {
  it("offers prefix matches before word and substring matches", () => {
    const pepper = { id: "r", name: "Red pepper", imageUrl: null };
    const names = suggestIngredientNames("pe", [
      ...catalog,
      pepper,
      { ...egg, id: "q", name: "Crêpe" },
    ]).map((s) => s.name);

    expect(names).toEqual(["Red pepper", "Crêpe"]);
  });

  it("offers each entry once, with the picture it will show", () => {
    const suggestions = suggestIngredientNames("flo", catalog);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      ingredientId: "f",
      name: "Flour",
      imageUrl: "/f.webp",
    });
  });

  it("leaves out the entry a name already matches, but not longer names", () => {
    const whites = { id: "n", name: "Eggs, white only", imageUrl: null };
    const names = [...catalog, whites];

    expect(suggestIngredientNames("egg", names).map((s) => s.name)).toEqual([
      "Eggs",
      "Eggs, white only",
    ]);
    // "Eggs" is what the line means already; the longer name is still offered.
    expect(suggestIngredientNames("eggs", names).map((s) => s.name)).toEqual(["Eggs, white only"]);
  });

  it("offers nothing for a single character", () => {
    expect(suggestIngredientNames("e", catalog)).toEqual([]);
  });

  it("respects the limit", () => {
    expect(suggestIngredientNames("e", catalog, 1)).toHaveLength(0);
    expect(suggestIngredientNames("an", catalog, 1)).toHaveLength(1);
  });
});

describe("ingredientLineNamePart", () => {
  it("finds the name after the amount and unit", () => {
    const text = "2 cups flo";
    const part = ingredientLineNamePart(text, {});

    expect(part).toEqual({ name: "flo", start: 7, end: 10 });
  });

  it("treats a bare name as the whole line", () => {
    expect(ingredientLineNamePart("cilan", {})).toEqual({ name: "cilan", start: 0, end: 5 });
  });

  it("ignores headings, empty lines and pasted lists", () => {
    expect(ingredientLineNamePart("# Sauce", {})).toBeNull();
    expect(ingredientLineNamePart("   ", {})).toBeNull();
    expect(ingredientLineNamePart("2 eggs\n1 cup flour", {})).toBeNull();
  });
});

describe("replaceIngredientLineName", () => {
  it("rewrites only the name part", () => {
    const text = "2 cups flo";
    const part = ingredientLineNamePart(text, {})!;

    expect(replaceIngredientLineName(text, part, "Flour")).toBe("2 cups Flour");
  });
});
