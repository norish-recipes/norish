import { describe, expect, it } from "vitest";

import { foodNamedAsTyped } from "@norish/shared-react/ingredients";
import { BASE_SPELLING_RULES } from "@norish/shared/lib/spelling-keys";

import { pantryAddList, pantryAddRows, pickedFood } from "../utils/pantry-add-rows";

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

describe("pantryAddList", () => {
  const suggestion = (name: string, recipeCount = 2) => ({
    ingredientId: `i-${name}`,
    name,
    localeNames: {},
    recipeCount,
  });
  const offered = ["a", "b", "c", "d", "e", "f", "g"].map((name) => suggestion(name));
  const base = { typed: "", isRead: true, offered, showAll: false, matches: [oil], custom: null };

  it("offers the first suggestions with their recipe count, the header and Show more", () => {
    const list = pantryAddList(base, "en");

    expect(list.rows.map((row) => row.foodId)).toEqual(["i-a", "i-b", "i-c", "i-d", "i-e", "i-f"]);
    expect(list.rows[0]?.recipeCount).toBe(2);
    expect(list.rows[0]?.keeps).toEqual({ ingredientId: "i-a", name: "a", localeNames: {} });
    expect([list.fromYourRecipes, list.more]).toEqual([true, true]);
    expect(pantryAddList({ ...base, showAll: true }, "en")).toMatchObject({ more: false });
    expect(pantryAddList({ ...base, showAll: true }, "en").rows).toHaveLength(7);
  });

  it("lists the matches once something is typed, with no recipe count", () => {
    const list = pantryAddList({ ...base, typed: "oli", custom: "oli" }, "en");

    expect(list.rows.map((row) => [row.foodId, row.recipeCount])).toEqual([
      ["i-oil", null],
      [null, null],
    ]);
    expect([list.fromYourRecipes, list.more]).toEqual([false, false]);
  });

  it("suggests nothing until the Pantry is read, or with nothing to offer", () => {
    for (const input of [
      { ...base, isRead: false },
      { ...base, offered: [] },
    ]) {
      expect(pantryAddList(input, "en")).toMatchObject({ fromYourRecipes: false, more: false });
      expect(pantryAddList(input, "en").rows.map((row) => row.foodId)).toEqual(["i-oil"]);
    }
  });
});
