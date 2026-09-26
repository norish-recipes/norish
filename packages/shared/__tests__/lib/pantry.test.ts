import { describe, expect, it } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { pantryIngredientFor, sortPantryIngredients } from "@norish/shared/lib/pantry";

function item(name: string, normalizedName: string): PantryIngredientDto {
  return {
    id: `id-${normalizedName}`,
    userId: "u1",
    ingredientId: `i-${normalizedName}`,
    name,
    normalizedName,
    version: 1,
  };
}

const pantry = [
  item("Olive Oil", "olive oil"),
  item("Salt", "salt"),
  item("Crème fraîche", "creme fraiche"),
];

describe("pantryIngredientFor", () => {
  const text = (ingredientName: string | null) => ({ ingredientName });

  it("covers a line of the same Ingredient, whatever either is spelled", () => {
    expect(
      pantryIngredientFor(pantry, { ingredientId: "i-olive oil", ingredientName: "EVOO, cold" })
        ?.name
    ).toBe("Olive Oil");
  });

  it("never covers a line of another Ingredient, even one spelled alike", () => {
    expect(pantryIngredientFor(pantry, { ingredientId: "i-other", ingredientName: "salt" })).toBe(
      null
    );
  });

  it("matches a text nothing has resolved on its folded name", () => {
    expect(pantryIngredientFor(pantry, text("olive oil"))?.name).toBe("Olive Oil");
    expect(pantryIngredientFor(pantry, text("  OLIVE  OIL! "))?.name).toBe("Olive Oil");
    expect(pantryIngredientFor(pantry, text("creme fraîche"))?.name).toBe("Crème fraîche");
  });

  it("never matches a text on part of a name", () => {
    expect(pantryIngredientFor(pantry, text("extra virgin olive oil"))).toBeNull();
    expect(pantryIngredientFor(pantry, text("salted butter"))).toBeNull();
    expect(pantryIngredientFor(pantry, text("sea salt"))).toBeNull();
  });

  it("is null for nothing at all", () => {
    expect(pantryIngredientFor(pantry, text(""))).toBeNull();
    expect(pantryIngredientFor(pantry, text("   "))).toBeNull();
    expect(pantryIngredientFor(pantry, text(null))).toBeNull();
    expect(pantryIngredientFor([], text("salt"))).toBeNull();
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
