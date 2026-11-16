import { describe, expect, it } from "vitest";

import type { PantryIngredientDto, PantrySuggestionDto } from "@norish/shared/contracts";
import { SUGGESTIONS_SHOWN } from "@norish/shared/lib/pantry";

import { pantryRows as rowsOf } from "../utils/pantry-rows";

const kept = (name: string): PantryIngredientDto => ({
  id: `p-${name}`,
  userId: "u",
  ingredientId: `i-${name}`,
  name,
  version: 1,
  ancestorIds: [],
  localeNames: {},
});
const suggestion = (name: string): PantrySuggestionDto => ({
  ingredientId: `s-${name}`,
  name,
  localeNames: {},
  recipeCount: 2,
});

const base = {
  items: [] as PantryIngredientDto[],
  kept: [] as PantryIngredientDto[],
  onTheList: [] as string[],
  matches: [] as { id: string; name: string }[],
  offered: [] as PantrySuggestionDto[],
  typed: "",
  suggestionsOpen: true,
  showAll: false,
};
/** The rows of a state given as one flat object. */
const pantryRows = ({ typed, suggestionsOpen, showAll, ...foods }: typeof base) =>
  rowsOf(foods, { typed, suggestionsOpen, showAll });
const types = (rows: ReturnType<typeof pantryRows>) => rows.map((row) => row.type);

describe("pantryRows", () => {
  it("says an empty Pantry is empty, and a search with no hit has no results", () => {
    expect(pantryRows(base)).toMatchObject([{ type: "note", text: "empty" }]);
    expect(pantryRows({ ...base, items: [kept("salt")], typed: "x" })).toMatchObject([
      { type: "note", text: "noMatch" },
    ]);
  });

  it("rounds the first and last kept food and marks the ones on the list", () => {
    const [a, b, c] = [kept("a"), kept("b"), kept("c")] as [
      PantryIngredientDto,
      PantryIngredientDto,
      PantryIngredientDto,
    ];
    const rows = pantryRows({ ...base, items: [a, b, c], kept: [a, b, c], onTheList: [b.id] });

    expect(rows.map((row) => (row.type === "kept" ? row.edge : null))).toEqual([
      { top: true, bottom: false },
      { top: false, bottom: false },
      { top: false, bottom: true },
    ]);
    expect(rows.map((row) => (row.type === "kept" ? row.onList : null))).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("offers catalogue foods under the kept ones, and suggestions only for an empty field", () => {
    const match = { id: "m", name: "Olives" };
    const offered = [suggestion("rice")];
    const searching = pantryRows({
      ...base,
      items: [kept("salt")],
      kept: [kept("salt")],
      matches: [match],
      offered,
      typed: "oli",
    });

    expect(types(searching)).toEqual(["kept", "label", "match"]);
    expect(
      types(pantryRows({ ...base, items: [kept("salt")], kept: [kept("salt")], offered }))
    ).toEqual(["kept", "suggestions", "suggestion"]);
  });

  it("folds the suggestions, and shows a handful before Show more", () => {
    const offered = Array.from({ length: SUGGESTIONS_SHOWN + 2 }, (_, i) => suggestion(`f${i}`));

    expect(types(pantryRows({ ...base, offered, suggestionsOpen: false }))).toEqual([
      "note",
      "suggestions",
    ]);
    const rows = pantryRows({ ...base, offered });

    expect(types(rows).filter((type) => type === "suggestion")).toHaveLength(SUGGESTIONS_SHOWN);
    expect(types(rows).at(-1)).toBe("more");
    expect(
      types(pantryRows({ ...base, offered, showAll: true })).filter((t) => t === "suggestion")
    ).toHaveLength(SUGGESTIONS_SHOWN + 2);
  });
});

describe("a row's foodId", () => {
  it("is the food it shows the icon of, and null for rows naming no food", () => {
    const rows = pantryRows({
      ...base,
      items: [kept("salt")],
      kept: [kept("salt")],
      matches: [{ id: "m1", name: "Rice" }],
      offered: [suggestion("kale")],
    });

    expect(rows.map((row) => [row.type, row.foodId])).toEqual([
      ["kept", "i-salt"],
      ["label", null],
      ["match", "m1"],
      ["suggestions", null],
      ["suggestion", "s-kale"],
    ]);
  });

  it("names the suggestion's food and none for the more row", () => {
    const offered = Array.from({ length: SUGGESTIONS_SHOWN + 1 }, (_, i) => suggestion(`f${i}`));
    const rows = pantryRows({ ...base, items: [kept("a")], kept: [kept("a")], offered });

    expect(rows.find((row) => row.type === "suggestion")?.foodId).toBe("s-f0");
    expect(rows.at(-1)).toMatchObject({ type: "more", foodId: null });
  });
});
