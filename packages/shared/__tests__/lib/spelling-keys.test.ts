import { describe, expect, it } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";
import {
  foodKey,
  ingredientAliasFold,
  spellingKeys,
  stripPreparation,
} from "@norish/shared/lib/spelling-keys";

import { SPELLING_CASES } from "./spelling-cases";

/** A Pantry Ingredient added offline: the optimistic row knows its name and not its Ingredient. */
function unsynced(name: string): PantryIngredientDto {
  return {
    id: `id-${name}`,
    userId: "u1",
    ingredientId: "",
    name,
    version: 1,
    ancestorIds: [],
    localeNames: {},
  };
}

describe("spelling keys", () => {
  it("strips the preparation after a comma and in brackets, an unclosed one to the end", () => {
    expect(stripPreparation("onions, diced")).toBe("onions");
    expect(stripPreparation("onions (red), sliced")).toBe("onions");
    expect(stripPreparation("onion (red, diced")).toBe("onion");
    expect(stripPreparation("(2)")).toBe("");
  });

  it("keys a punctuation-only text by its lowercase self, never by nothing", () => {
    expect(ingredientAliasFold("!!!")).toBe("!!!");
    expect(foodKey("!!!")).toBe("!!!");
    expect(foodKey("   ")).toBe("");
  });

  it("answers both rungs' keys for a text", () => {
    expect(spellingKeys("Onions, Diced")).toEqual({
      fold: "onions diced",
      bare: "Onions",
      bareFold: "onions",
    });
  });

  it.each(SPELLING_CASES)("offline, a Pantry %j covers a line %j: %s", (pantry, line, covered) => {
    expect(pantryIngredientFor([unsynced(pantry)], { ingredientName: line }) !== null).toBe(
      covered
    );
  });
});
