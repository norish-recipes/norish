/**
 * Multi-word unit names, against the real shipped units configuration.
 *
 * `parse-ingredient` tests only the first word after a quantity, and that word
 * joined to the next, against its unit table. A French recipe writes
 * "cuillères à soupe" and got nothing, while the abbreviation "càs" — which
 * Norish itself renders back as "cuillères à soupe" — was recognised (#535).
 *
 * These assert the whole seam every caller uses, not the helpers underneath:
 * what matters is what the parser returns for a line a person actually typed.
 */

import { describe, expect, it } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import defaultUnits from "@norish/config/units.default.json";
import { parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { collectMultiWordUnits, findLeadingUnit } from "@norish/shared/lib/unit-localization";

const unitsConfig = defaultUnits as UnitsMap;

function parse(line: string) {
  return parseIngredientWithDefaults(line, unitsConfig)[0];
}

describe("multi-word units", () => {
  it("reads the French name the app itself displays", () => {
    const parsed = parse("1 cuillères à soupe de miel");

    expect(parsed.unitOfMeasureID).toBe("tablespoon");
    expect(parsed.unitOfMeasure).toBe("cuillères à soupe");
    expect(parsed.quantity).toBe(1);
    expect(parsed.description).toBe("de miel");
  });

  it("reads the singular French name too", () => {
    expect(parse("1 cuillère à café de sucre").unitOfMeasureID).toBe("teaspoon");
  });

  it("agrees with the abbreviation it is displayed as", () => {
    expect(parse("1 càs de miel").unitOfMeasureID).toBe(parse("1 cuillères à soupe de miel").unitOfMeasureID);
  });

  it("still reads the quantity in every shape the parser accepts", () => {
    expect(parse("½ cuillère à soupe d'huile").quantity).toBe(0.5);
    expect(parse("1-2 cuillères à soupe de miel").quantity).toBe(1);
    expect(parse("1,5 cuillères à soupe de miel").quantity).toBe(1.5);
  });

  it("prefers the longest name a line starts with", () => {
    // "spiseskefuld" alone is a tablespoon; with "med top" it is a heaped one.
    expect(parse("1 spiseskefuld med top sukker").unitOfMeasureID).toBe("heaping_tablespoon");
    expect(parse("1 spiseskefuld sukker").unitOfMeasureID).toBe("tablespoon");
  });

  it("reads a name carrying punctuation the parser's word split drops", () => {
    const parsed = parse("2 el, gehäuft Zucker");

    expect(parsed.unitOfMeasureID).toBe("heaping_tablespoon");
    expect(parsed.description).toBe("Zucker");
  });

  it("reads a unit named without a quantity, as single-word units already were", () => {
    expect(parse("cuillères à soupe de miel").unitOfMeasureID).toBe("tablespoon");
  });

  it("leaves a line that is only a unit as its own description", () => {
    // Same refusal the parser makes for "2 tbsp": consuming it would leave an
    // ingredient with no name at all.
    const parsed = parse("1 cuillères à soupe");

    expect(parsed.unitOfMeasureID).toBeNull();
    expect(parsed.description).toBe("cuillères à soupe");
  });

  it("leaves single- and two-word units exactly as they were", () => {
    expect(parse("2 tbsp honey")).toMatchObject({
      unitOfMeasureID: "tablespoon",
      unitOfMeasure: "tbsp",
      description: "honey",
    });
    expect(parse("1 cup of flour")).toMatchObject({ unitOfMeasureID: "cup", description: "flour" });
    expect(parse("1 gehäufte prise Salz").unitOfMeasureID).toBe("generous_pinch");
    expect(parse("3 pommes")).toMatchObject({ unitOfMeasureID: null, description: "pommes" });
  });
});

describe("findLeadingUnit", () => {
  const phrases = collectMultiWordUnits(unitsConfig);

  it("collects names of more than one word, longest first", () => {
    expect(phrases.every((p) => /\s/.test(p.phrase))).toBe(true);
    expect(phrases.map((p) => p.phrase.length)).toEqual(
      [...phrases.map((p) => p.phrase.length)].sort((a, b) => b - a)
    );
  });

  it("only matches a name where a unit belongs", () => {
    // The name is in the line, but as part of what the dish is, not as a unit.
    expect(findLeadingUnit("miel au parfum de cuillères à soupe", phrases)).toBeNull();
  });

  it("only matches a whole name", () => {
    expect(findLeadingUnit("2 a pincher of nothing", phrases)).toBeNull();
  });
});
