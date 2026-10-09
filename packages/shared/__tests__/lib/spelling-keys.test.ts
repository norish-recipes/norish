import { describe, expect, it } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import defaultUnits from "@norish/config/units.default.json";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";
import {
  foodKey,
  ingredientAliasFold,
  spellingKeys,
  spellingRules,
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

const phrases = spellingRules(defaultUnits as UnitsMap);

describe("spelling keys", () => {
  it("strips the preparation after a comma and in brackets, an unclosed one to the end", () => {
    expect(stripPreparation("onions, diced")).toBe("onions");
    expect(stripPreparation("onions (red), sliced")).toBe("onions");
    expect(stripPreparation("onion (red, diced")).toBe("onion");
    expect(stripPreparation("(2)")).toBe("");
  });

  it("strips a social media mention wherever it stands, and nothing that only looks like one", () => {
    expect(stripPreparation("@blueband_nl Finesse")).toBe("Finesse");
    expect(stripPreparation("olijfolie @bertolli.nl extra vergine")).toBe(
      "olijfolie extra vergine"
    );
    expect(stripPreparation("@kikkoman @kikkoman_nl sojasaus")).toBe("sojasaus");
    expect(stripPreparation("info@example.com")).toBe("info@example.com");
    expect(stripPreparation("@ 200 g")).toBe("@ 200 g");
    // A text that is only a mention keeps no bare name, as a bracket alone keeps none.
    expect(stripPreparation("@blueband_nl")).toBe("");
    // The food is named without it, and found under its own name.
    expect(spellingKeys("@blueband_nl Finesse 15%", phrases)).toMatchObject({
      bare: "Finesse 15%",
      plain: "Finesse",
      plainFold: "finesse",
    });
    expect(foodKey("@kikkoman sojasaus", phrases)).toBe(foodKey("sojasaus", phrases));
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
      plain: "Onions",
      plainFold: "onions",
    });
  });

  it("strips preparation written without a comma, at either end, and names the food as written", () => {
    expect(spellingKeys("Garlic cloves crushed", phrases)).toMatchObject({
      bare: "Garlic cloves crushed",
      plain: "Garlic cloves",
      plainFold: "garlic cloves",
    });
    expect(foodKey("piece of ginger peeled and finely chopped", phrases)).toBe("ginger");
    expect(foodKey("finely chopped onion", phrases)).toBe("onion");
    expect(foodKey("cherry tomatoes 5 chopped", phrases)).toBe("cherry tomatoes");
    expect(foodKey("coriander leaves picked, stalks finely chopped", phrases)).toBe(
      "coriander leaves"
    );
    expect(foodKey("gesnipperde ui", phrases)).toBe("ui");
    // A joiner is stripped only beside a preparation word.
    expect(foodKey("salt and pepper", phrases)).toBe("salt and pepper");
    // A word that names a different food stays.
    expect(foodKey("ground beef", phrases)).toBe("ground beef");
    expect(foodKey("dried apricots", phrases)).toBe("dried apricots");
    expect(foodKey("chopped", phrases)).toBe("chopped");
  });

  it("names the food without the punctuation at the edges of its words", () => {
    expect(spellingKeys("(2.7lbs) - Fresh Salmon, Cut Into 5 Fillets", phrases)).toMatchObject({
      bare: "- Fresh Salmon",
      bareFold: "fresh salmon",
      plain: "Fresh Salmon",
      plainFold: "fresh salmon",
    });
    expect(spellingKeys("chicken breasts * ", phrases).plain).toBe("chicken breasts");
    // Punctuation inside a word is the word's.
    expect(spellingKeys("half-and-half", phrases).plain).toBe("half-and-half");
  });

  it("keeps the text as written where the cut would split a word of it", () => {
    expect(spellingKeys("thumb-sized piece ginger grated", phrases)).toMatchObject({
      plain: "thumb-sized piece ginger",
      plainFold: "thumb sized piece ginger",
    });
    // "freeze-dried" folds to two words; nothing is stripped from inside it.
    expect(spellingKeys("freeze-dried curry leaves", phrases).plain).toBe(
      "freeze-dried curry leaves"
    );
  });

  it("strips a container from the units map at the start of a text, never at its end", () => {
    expect(foodKey("can of chickpeas drained and rinsed", phrases)).toBe("chickpeas");
    // A quantity an import left at the start goes first, so the can is at the start then.
    expect(foodKey("400g can chickpeas", phrases)).toBe("chickpeas");
    expect(foodKey("pak koriander", phrases)).toBe("koriander");
    expect(foodKey("blik tomaten", phrases)).toBe("tomaten");
    expect(foodKey("pepper pot", phrases)).toBe("pepper pot");
    expect(foodKey("onion pieces", phrases)).toBe("onion pieces");
    expect(foodKey("can of chickpeas")).toBe("can of chickpeas");
  });

  it("strips a weight or a volume at the start of a text, with or without its number", () => {
    // An import that moved the number to the amount and left its unit in the name.
    expect(foodKey("GR CHERRYTOMATEN", phrases)).toBe("cherrytomaten");
    expect(foodKey("tl. Citroensap", phrases)).toBe("citroensap");
    expect(foodKey("EL MAYONAISE", phrases)).toBe("mayonaise");
    expect(spellingKeys("Cup (250ml) - Buttermilk", phrases)).toMatchObject({
      plain: "Buttermilk",
      plainFold: "buttermilk",
    });
    expect(foodKey("heaped tablespoons peanut butter", phrases)).toBe("peanut butter");
    expect(foodKey("cup of milk", phrases)).toBe("milk");
    // A one-letter spelling is left alone: "T-bone", "L. reuteri".
    expect(foodKey("T-bone steak", phrases)).toBe("t bone steak");
    // A measure alone stands, as any text does.
    expect(foodKey("el", phrases)).toBe("el");
    // Without a units map nothing is a measure.
    expect(foodKey("GR CHERRYTOMATEN")).toBe("gr cherrytomaten");
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

  it("strips vague amounts and serving phrases, never a piece, which names foods too", () => {
    expect(foodKey("onion rings", phrases)).toBe("onion rings");
    expect(foodKey("glass noodles", phrases)).toBe("glass noodles");
    expect(foodKey("garlic cloves", phrases)).toBe("garlic cloves");
    expect(foodKey("olive oil, a splash", phrases)).toBe("olive oil");
    expect(foodKey("a splash of olive oil", phrases)).toBe("olive oil");
    expect(foodKey("a handful of basil", phrases)).toBe("basil");
  });

  it("strips what the administrator's units map says, and nothing without one", () => {
    const own = spellingRules({
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
