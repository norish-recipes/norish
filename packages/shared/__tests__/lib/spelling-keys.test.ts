import { describe, expect, it } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import defaultUnits from "@norish/config/units.default.json";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";
import {
  cleanSpelling,
  DEFAULT_INGREDIENT_WORDS,
  foodKey,
  ingredientAliasFold,
  joinedParts,
  sameFood,
  spellingKeys,
  spellingRules,
  stripPreparation,
  wholeFoodKey,
  withoutStrayMarks,
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
    expect(stripPreparation("butter [optional], softened")).toBe("butter");
    expect(stripPreparation("rice (basmati) [or jasmine (Thai)")).toBe("rice");
    // Brackets inside brackets go with them, as a single pair would.
    expect(stripPreparation("onion (red (x) y) chopped")).toBe("onion chopped");
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

  it("reads a text without stray marks, doubled brackets, prices and notes", () => {
    for (const text of [
      "gyoza vellen ((ontdooid))",
      "gyoza vellen (ontdooid)",
      "12 gyoza vellen",
    ]) {
      expect(foodKey(text, phrases)).toBe("gyoza vellen");
    }
    expect(spellingKeys("gyoza vellen ((ontdooid))", phrases)).toMatchObject({
      fold: "gyoza vellen",
      bare: "gyoza vellen",
      plain: "gyoza vellen",
    });
    expect(spellingKeys("baking soda (($0.02))", phrases).fold).toBe("baking soda");
    expect(spellingKeys("baking soda ($0.02)", phrases).fold).toBe("baking soda");
    expect(spellingKeys("baking soda €0,02", phrases).fold).toBe("baking soda");
    expect(spellingKeys("baking soda 0,02 €", phrases).fold).toBe("baking soda");
    expect(spellingKeys("sugar (Note 1)", phrases).fold).toBe("sugar");
    expect(spellingKeys("sugar (see notes 2 & 3)", phrases).fold).toBe("sugar");
    // An old import wrote a missing amount as "null" before the name.
    expect(spellingKeys("null zout", phrases)).toMatchObject({ fold: "zout", plain: "zout" });
    for (const text of ["+ eggs", "/ eggs", "- eggs", ": eggs"]) {
      expect(spellingKeys(text, phrases)).toMatchObject({ bare: "eggs", plain: "eggs" });
    }
    // A bracket that pairs stays for rung 1: the seed spells foods apart by it.
    expect(spellingKeys("paprika (vrucht)", phrases)).toMatchObject({
      fold: "paprika vrucht",
      bare: "paprika",
    });
  });

  it("leaves no key ending in a bracket that never opened", () => {
    for (const text of ["baking soda )", "olijfolie basilicum))", "3wu)", "gyoza vellen )"]) {
      for (const key of Object.values(spellingKeys(text, phrases))) {
        expect(key).not.toMatch(/[)\]}]$/);
      }
    }
    expect(spellingKeys("baking soda )", phrases).bare).toBe("baking soda");
  });

  it("cleans a seeded spelling of its stray marks and keeps the brackets that pair", () => {
    expect(withoutStrayMarks("3wu)")).toBe("3wu");
    expect(withoutStrayMarks("|चौलाई}}")).toBe("चौलाई");
    expect(withoutStrayMarks("paprika (vrucht)")).toBe("paprika (vrucht)");
    expect(withoutStrayMarks("aroma [mela]")).toBe("aroma [mela]");
    expect(withoutStrayMarks("half-and-half")).toBe("half-and-half");
    expect(withoutStrayMarks("1,5% melk")).toBe("1,5% melk");
    expect(withoutStrayMarks("salt {fine}")).toBe("salt {fine}");
    expect(withoutStrayMarks("{chef} salt")).toBe("{chef} salt");
    // A bracket opened at the very end closes nothing.
    expect(withoutStrayMarks("olie )(")).toBe("olie");
  });

  it("cleans a text to a fixed point, so a clean text reads the same cleaned again", () => {
    for (const text of [
      "((x) (Note 1))",
      "salt (Note 1) -",
      "(Note 2) - salt",
      "olie )(",
      "a ($1) (b)",
    ]) {
      const clean = cleanSpelling(text);

      expect(cleanSpelling(clean)).toBe(clean);
      expect(spellingKeys(text, phrases).clean).toBe(clean);
    }
    expect(cleanSpelling("(Note 2) - salt")).toBe("salt");
  });

  it("keys a punctuation-only text by its lowercase self, never by nothing", () => {
    expect(ingredientAliasFold("!!!")).toBe("!!!");
    expect(foodKey("!!!")).toBe("!!!");
    expect(foodKey("   ")).toBe("");
  });

  it("answers both rungs' keys for a text", () => {
    expect(spellingKeys("Onions, Diced", phrases)).toEqual({
      clean: "Onions, Diced",
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
      bare: "Fresh Salmon",
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
    expect(foodKey("1 kilo krieltjes", phrases)).toBe("krieltjes");
    expect(foodKey("kilo krieltjes", phrases)).toBe("krieltjes");
    expect(foodKey("2 tbs olive oil", phrases)).toBe("olive oil");
    expect(foodKey("2 koffielepels suiker", phrases)).toBe("suiker");
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

  it("strips a joining word the parser left at the start, never one inside the name", () => {
    // "200 g di farina": the amount and unit are the line's, "di farina" its name.
    expect(foodKey("di farina", phrases)).toBe("farina");
    expect(foodKey("d'aglio", phrases)).toBe("aglio");
    expect(foodKey("de miel", phrases)).toBe("miel");
    expect(spellingKeys("di Grana Padano DOP", phrases).plain).toBe("Grana Padano DOP");
    expect(foodKey("farina di semola", phrases)).toBe("farina di semola");
    expect(foodKey("di", phrases)).toBe("di");
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
    expect(foodKey("handjevol basilicum", phrases)).toBe("basilicum");
    expect(foodKey("toppings as desired", phrases)).toBe("toppings");
    expect(foodKey("water, as needed", phrases)).toBe("water");
    expect(foodKey("kaas naar wens", phrases)).toBe("kaas");
    expect(foodKey("snuf zout", phrases)).toBe("zout");
    expect(foodKey("flinke snuf nootmuskaat", phrases)).toBe("nootmuskaat");
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

  it("splits a name at the words that join foods, and says how they go together", () => {
    expect(joinedParts("zout en peper", phrases)).toMatchObject({
      parts: ["zout", "peper"],
      joined: "together",
    });
    expect(joinedParts("Arla Skyr Peach & Passionfruit", phrases)).toMatchObject({
      parts: ["Arla Skyr Peach", "Passionfruit"],
      joined: "together",
    });
    expect(joinedParts("boter of olie", phrases)).toMatchObject({
      parts: ["boter", "olie"],
      joined: "alternatives",
    });
    expect(joinedParts("parmezaanse kaas en/of pijnboompitten", phrases)).toMatchObject({
      parts: ["parmezaanse kaas", "pijnboompitten"],
      joined: "alternatives",
    });
    expect(joinedParts("salt, pepper and sugar", phrases)?.parts).toEqual([
      "salt, pepper",
      "sugar",
    ]);
  });

  it("splits at a slash as or and a plus as and, spaced or between two letters", () => {
    expect(joinedParts("Salt/pepper", phrases)).toMatchObject({
      parts: ["Salt", "pepper"],
      joined: "alternatives",
    });
    expect(joinedParts("crème fraîche / sour cream", phrases)).toMatchObject({
      parts: ["crème fraîche", "sour cream"],
      joined: "alternatives",
    });
    expect(joinedParts("salt + black pepper", phrases)).toMatchObject({
      parts: ["salt", "black pepper"],
      joined: "together",
    });
    expect(joinedParts("salt&pepper", phrases)?.joined).toBe("together");
    // A joining word written with a slash stays one word, and a fraction is no join.
    expect(joinedParts("thighs and/or drumsticks", phrases)?.parts).toEqual([
      "thighs",
      "drumsticks",
    ]);
    expect(joinedParts("1/2 lemon", phrases)).toBeNull();
  });

  it("never splits inside brackets, at an edge, or where and and or are mixed", () => {
    expect(joinedParts("kip (dij en borst)", phrases)).toBeNull();
    expect(joinedParts("and pepper", phrases)).toBeNull();
    expect(joinedParts("salt and", phrases)).toBeNull();
    expect(joinedParts("salt and pepper or chili", phrases)).toBeNull();
    expect(joinedParts("onions", phrases)).toBeNull();
  });

  it("knows the languages where a joining word joins a measure to its food instead", () => {
    expect(joinedParts("juice of a lemon", phrases)?.words[0]?.connectorIn).toEqual(
      new Set(["en"])
    );
    expect(joinedParts("zout en peper", phrases)?.words[0]?.connectorIn).toEqual(new Set());
    expect(joinedParts("zout & peper", phrases)?.words[0]?.connectorIn).toEqual(new Set());
  });

  it("splits at the joining words the administrator's set has, and only those", () => {
    const own = spellingRules(defaultUnits as UnitsMap, {
      nl: { ...DEFAULT_INGREDIENT_WORDS.nl!, alternatives: ["en/of"] },
    });

    expect(joinedParts("boter of olie", own)).toBeNull();
    expect(joinedParts("boter en/of olie", own)?.joined).toBe("alternatives");
  });

  it("reads a name whole for sameFood when asked: sliced ham is ham, but not read whole", () => {
    expect(sameFood("sliced ham", "ham", phrases)).toBe(true);
    expect(sameFood("sliced ham", "ham", phrases, wholeFoodKey)).toBe(false);
    expect(sameFood("guajillo chilies", "guajillo chili", phrases, wholeFoodKey)).toBe(true);
    expect(sameFood("broccolini", "broccoli", phrases, wholeFoodKey)).toBe(false);
  });

  it.each(SPELLING_CASES)("offline, a Pantry %j covers a line %j: %s", (pantry, line, covered) => {
    expect(
      pantryIngredientFor([unsynced(pantry)], { ingredientName: line }, phrases) !== null
    ).toBe(covered);
  });
});
