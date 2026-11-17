import { describe, expect, it } from "vitest";

import { foodNamedAsTyped } from "@norish/shared-react/ingredients";
import { BASE_SPELLING_RULES } from "@norish/shared/lib/spelling-keys";

import { pantryAddRows, pickedFood, suggestedMatches } from "../utils/pantry-add-rows";

const olives = { id: "i-olives", name: "Olives", localeNames: {} };
const oil = { id: "i-oil", name: "Olive oil", localeNames: {} };
const milk = { id: "i-milk", name: "Milk", localeNames: { nl: "Melk" } };

describe("pantryAddRows", () => {
  it("lists the catalogue foods, then the typed text as a custom entry", () => {
    const rows = pantryAddRows([olives, oil], "oli", "en");

    expect(rows.map((row) => [row.foodId, row.name, row.testIDs.button])).toEqual([
      ["i-olives", "Olives", "pantry-match-i-olives"],
      ["i-oil", "Olive oil", "pantry-match-i-oil"],
      [null, "oli", "pantry-add-custom"],
    ]);
    expect(rows.map((row) => row.keeps)).toEqual([pickedFood(olives), pickedFood(oil), "oli"]);
  });

  it("names a found food in the viewer's language", () => {
    expect(pantryAddRows([milk], null, "nl")[0]?.name).toBe("Melk");
  });

  it("rounds the first and last row of the one card", () => {
    expect(pantryAddRows([olives, oil], "oli", "en").map((row) => row.edge)).toEqual([
      { top: true, bottom: false },
      { top: false, bottom: false },
      { top: false, bottom: true },
    ]);
    expect(pantryAddRows([olives], null, "en")[0]?.edge).toEqual({ top: true, bottom: true });
  });

  it("offers no custom row when the text names a found food", () => {
    const typed = "eggs";
    const egg = { id: "i-egg", name: "Egg", localeNames: {} };
    const named = foodNamedAsTyped(typed, [egg], BASE_SPELLING_RULES);

    expect(named?.id).toBe("i-egg");
    expect(pantryAddRows([egg], named ? null : typed, "en").map((row) => row.foodId)).toEqual([
      "i-egg",
    ]);
    expect(pantryAddRows([], null, "en")).toEqual([]);
  });
});

describe("suggestedMatches", () => {
  const salt = {
    ingredientId: "i-salt",
    name: "Salt",
    localeNames: { nl: "Zout" },
    recipeCount: 4,
  };
  const rice = { ingredientId: "i-rice", name: "Rice", localeNames: {}, recipeCount: 2 };

  it("offers the foods the Pantry does not cover, as rows that keep them", () => {
    const kept = [
      {
        id: "p-salt",
        version: 1,
        userId: "u",
        ingredientId: "i-salt",
        name: "Salt",
        ancestorIds: [],
        localeNames: {},
      },
    ];
    const rows = pantryAddRows(
      suggestedMatches(kept, [salt, rice], BASE_SPELLING_RULES),
      null,
      "en"
    );

    expect(rows.map((row) => row.foodId)).toEqual(["i-rice"]);
    expect(rows[0]?.keeps).toEqual({ ingredientId: "i-rice", name: "Rice", localeNames: {} });
  });
});
