import { describe, expect, it } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { pantryIngredientFor, sortPantryIngredients } from "@norish/shared/lib/pantry";

function item(name: string, normalizedName: string): PantryIngredientDto {
  return { id: `id-${normalizedName}`, userId: "u1", name, normalizedName, version: 1 };
}

const pantry = [
  item("Olive Oil", "olive oil"),
  item("Salt", "salt"),
  item("Crème fraîche", "creme fraiche"),
];

describe("pantryIngredientFor", () => {
  it("matches a name whose folded form equals a Pantry Ingredient's", () => {
    expect(pantryIngredientFor(pantry, "olive oil")?.name).toBe("Olive Oil");
    expect(pantryIngredientFor(pantry, "  OLIVE  OIL! ")?.name).toBe("Olive Oil");
    expect(pantryIngredientFor(pantry, "creme fraîche")?.name).toBe("Crème fraîche");
  });

  it("never matches on part of a name", () => {
    expect(pantryIngredientFor(pantry, "extra virgin olive oil")).toBeNull();
    expect(pantryIngredientFor(pantry, "salted butter")).toBeNull();
    expect(pantryIngredientFor(pantry, "sea salt")).toBeNull();
  });

  it("is null for nothing at all", () => {
    expect(pantryIngredientFor(pantry, "")).toBeNull();
    expect(pantryIngredientFor(pantry, "   ")).toBeNull();
    expect(pantryIngredientFor(pantry, null)).toBeNull();
    expect(pantryIngredientFor([], "salt")).toBeNull();
  });
});

describe("sortPantryIngredients", () => {
  it("orders by name regardless of case and leaves the input alone", () => {
    const input = [item("salt", "salt"), item("Flour", "flour"), item("eggs", "eggs")];
    const sorted = sortPantryIngredients(input, "en");

    expect(sorted.map((i) => i.name)).toEqual(["eggs", "Flour", "salt"]);
    expect(input.map((i) => i.name)).toEqual(["salt", "Flour", "eggs"]);
  });

  it("orders in the reader's alphabet, not the runtime's", () => {
    const input = [item("Zucchini", "zucchini"), item("Öl", "ol")];

    expect(sortPantryIngredients(input, "de").map((i) => i.name)).toEqual(["Öl", "Zucchini"]);
    expect(sortPantryIngredients(input, "sv").map((i) => i.name)).toEqual(["Zucchini", "Öl"]);
  });
});
