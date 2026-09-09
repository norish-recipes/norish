/**
 * The one unit table: every spelling the units map carries in its fourteen
 * locales, the words shops print, parse-ingredient's built-ins and the
 * UN/CEFACT codes, resolved to a family and a magnitude. Units are a closed
 * set, which is why this is a table in code and not a setting.
 */
import { describe, expect, it } from "vitest";

import unitsMap from "@norish/config/units.default.json";
import { resolveUnit, resolveUnitCode, unitLabel } from "@norish/shared/lib/units";

describe("resolveUnit", () => {
  it.each([
    ["g", "mass", 1],
    ["gr", "mass", 1],
    ["gram", "mass", 1],
    ["grams", "mass", 1],
    ["kg", "mass", 1000],
    ["kilo", "mass", 1000],
    ["kilogram", "mass", 1000],
    ["ml", "volume", 1],
    ["cl", "volume", 10],
    ["dl", "volume", 100],
    ["l", "volume", 1000],
    ["L", "volume", 1000],
    ["liter", "volume", 1000],
    ["litre", "volume", 1000],
    ["oz", "mass", 28.349523],
    ["fl oz", "volume", 29.57353],
    ["lb", "mass", 453.59237],
    ["st", "count", 1],
    ["st.", "count", 1],
    ["stuk", "count", 1],
    ["stuks", "count", 1],
    ["pcs", "count", 1],
    ["pieces", "count", 1],
    ["piece", "count", 1],
    ["dozen", "count", 12],
    ["dz", "count", 12],
    ["teaspoon", "volume", 5],
    ["tl", "volume", 5],
    ["tablespoon", "volume", 15],
    ["el", "volume", 15],
    ["eetlepel", "volume", 15],
    ["cup", "volume", 240],
    ["kopje", "volume", 240],
  ])("knows %s as %s × %s", (spelling, family, magnitude) => {
    expect(resolveUnit(spelling)).toMatchObject({ family, magnitude });
  });

  it("reads a container word on a grocery as a number of packs", () => {
    for (const word of [
      "pack",
      "pak",
      "pakken",
      "box",
      "doos",
      "bottle",
      "fles",
      "can",
      "blik",
      "jar",
      "pot",
      "bag",
      "zak",
      "tub",
      "bakje",
      "bar",
      "reep",
      "roll",
      "rol",
      "pouch",
      "zakje",
      "carton",
      "package",
    ]) {
      expect(resolveUnit(word)?.family).toBe("pack");
    }
  });

  it("resolves every spelling the units map carries, in every locale, for the units it knows", () => {
    const known = new Set([
      "gram",
      "milliliter",
      "centiliter",
      "deciliter",
      "liter",
      "ounce",
      "pound",
      "teaspoon",
      "tablespoon",
      "heaping_teaspoon",
      "heaping_tablespoon",
      "scant_teaspoon",
      "scant_tablespoon",
      "cup",
      "piece",
      "dozen",
      "pack",
      "box",
      "bottle",
      "can",
      "jar",
      "bag",
      "tub",
      "bar",
      "roll",
      "pot",
      "pouch",
    ]);

    for (const [id, unit] of Object.entries(unitsMap)) {
      if (!known.has(id)) continue;
      const spellings = [
        id,
        ...unit.short.map((form) => form.name),
        ...unit.plural.map((form) => form.name),
        ...unit.alternates,
      ];

      for (const spelling of spellings) {
        expect(resolveUnit(spelling), `${id}: ${spelling}`).not.toBeNull();
      }
    }
  });

  it("resolves the Cyrillic and Hangul spellings the units map carries", () => {
    expect(resolveUnit("кг")).toMatchObject({ family: "mass", magnitude: 1000 });
    expect(resolveUnit("г")).toMatchObject({ family: "mass", magnitude: 1 });
    expect(resolveUnit("мл")).toMatchObject({ family: "volume", magnitude: 1 });
    expect(resolveUnit("шт")).toMatchObject({ family: "count", magnitude: 1 });
    expect(resolveUnit("그램")).toMatchObject({ family: "mass", magnitude: 1 });
    expect(resolveUnit("리터")).toMatchObject({ family: "volume", magnitude: 1000 });
    expect(resolveUnit("개")).toMatchObject({ family: "count", magnitude: 1 });
  });

  it("knows nothing of what is not a unit of sale", () => {
    for (const word of ["pinch", "snufje", "handful", "slice", "plakje", "clove", "bunch", ""]) {
      expect(resolveUnit(word), word).toBeNull();
    }
  });

  it("maps the UN/CEFACT codes shops write in their data", () => {
    expect(resolveUnitCode("GRM")).toMatchObject({ id: "gram" });
    expect(resolveUnitCode("KGM")).toMatchObject({ id: "kilogram" });
    expect(resolveUnitCode("LTR")).toMatchObject({ id: "liter" });
    expect(resolveUnitCode("MLT")).toMatchObject({ id: "milliliter" });
    expect(resolveUnitCode("CLT")).toMatchObject({ id: "centiliter" });
    expect(resolveUnitCode("ONZ")).toMatchObject({ id: "ounce" });
    expect(resolveUnitCode("LBR")).toMatchObject({ id: "pound" });
    for (const code of ["C62", "EA", "H87"]) {
      expect(resolveUnitCode(code)).toMatchObject({ id: "piece" });
    }
    expect(resolveUnitCode("XYZ")).toBeNull();
  });

  it("has a symbol for every unit it can store", () => {
    expect(unitLabel("gram")).toBe("g");
    expect(unitLabel("kilogram")).toBe("kg");
    expect(unitLabel("fluid_ounce")).toBe("fl oz");
    expect(unitLabel("piece")).toBe("piece");
  });
});
