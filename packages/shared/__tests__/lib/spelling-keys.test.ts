import { describe, expect, it } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import defaultUnits from "@norish/config/units.default.json";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";
import {
  foodKey,
  ingredientAliasFold,
  spellingKeys,
  stripPreparation,
  unitPhrases,
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

const phrases = unitPhrases(defaultUnits as UnitsMap);

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
    expect(spellingKeys("Onions, Diced", phrases)).toEqual({
      fold: "onions diced",
      bare: "Onions",
      bareFold: "onions",
      plainFold: "onions",
    });
  });

  it("strips a units-map phrase at either end, with the word that joins a leading one", () => {
    expect(foodKey("Salt to taste", phrases)).toBe("salt");
    expect(foodKey("a pinch of nutmeg", phrases)).toBe("nutmeg");
    expect(foodKey("pincée de sel", phrases)).toBe("sel");
    expect(foodKey("naar smaak zout", phrases)).toBe("zout");
    expect(foodKey("Salz n. B.", phrases)).toBe("salz");
    expect(foodKey("sal al gusto", phrases)).toBe("sal");
    expect(foodKey("a pinch of salt to taste", phrases)).toBe("salt");
  });

  it("keeps a phrase inside the name, and never strips a text to nothing", () => {
    expect(foodKey("cream to taste with sugar", phrases)).toBe("cream to taste with sugar");
    expect(foodKey("to taste", phrases)).toBe("to taste");
    expect(foodKey("vitamin c", phrases)).toBe("vitamin c");
  });

  it("strips vague amounts and serving phrases, never a measure or a piece, which name foods too", () => {
    expect(foodKey("onion rings", phrases)).toBe("onion rings");
    expect(foodKey("glass noodles", phrases)).toBe("glass noodles");
    expect(foodKey("garlic cloves", phrases)).toBe("garlic cloves");
    expect(foodKey("olive oil, a splash", phrases)).toBe("olive oil");
    expect(foodKey("a splash of olive oil", phrases)).toBe("olive oil");
    expect(foodKey("a handful of basil", phrases)).toBe("basil");
  });

  it("strips what the administrator's units map says, and nothing without one", () => {
    const own = unitPhrases({
      pinch: {
        short: [{ locale: "en", name: "pinch" }],
        plural: [{ locale: "en", name: "pinches" }],
        alternates: ["a smidgen"],
      },
    } as UnitsMap);

    expect(foodKey("a smidgen of nutmeg", own)).toBe("nutmeg");
    expect(foodKey("salt to taste", own)).toBe("salt to taste");
    expect(foodKey("salt to taste")).toBe("salt to taste");
  });

  it.each(SPELLING_CASES)("offline, a Pantry %j covers a line %j: %s", (pantry, line, covered) => {
    expect(
      pantryIngredientFor([unsynced(pantry)], { ingredientName: line }, phrases) !== null
    ).toBe(covered);
  });
});
