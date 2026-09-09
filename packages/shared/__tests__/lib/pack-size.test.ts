/**
 * The Pack Size read out of a shop's own size words, and out of the unit code
 * a shop's data states. "ca." is the number it prefixes; there is no
 * tolerance anywhere.
 */
import { describe, expect, it } from "vitest";

import { packSizeFromCode, readPackSize } from "@norish/shared/lib/pack-size";

describe("readPackSize", () => {
  it.each([
    ["500 g", { quantity: 500, unit: "gram", byWeight: false }],
    ["1,5 l", { quantity: 1.5, unit: "liter", byWeight: false }],
    ["0,5 liter", { quantity: 0.5, unit: "liter", byWeight: false }],
    ["6 x 33 cl", { quantity: 198, unit: "centiliter", byWeight: false }],
    ["3 x 250 ml", { quantity: 750, unit: "milliliter", byWeight: false }],
    ["6 × 50 g", { quantity: 300, unit: "gram", byWeight: false }],
    ["10 stuks", { quantity: 10, unit: "piece", byWeight: false }],
    ["8 st.", { quantity: 8, unit: "piece", byWeight: false }],
    ["Per stuk", { quantity: 1, unit: "piece", byWeight: false }],
    ["per stuk", { quantity: 1, unit: "piece", byWeight: false }],
    ["ca. 405 g", { quantity: 405, unit: "gram", byWeight: false }],
    ["ca. 1006 g", { quantity: 1006, unit: "gram", byWeight: false }],
    ["1 kg (ca. 5 stuks)", { quantity: 1, unit: "kilogram", byWeight: false }],
    ["1 kilogram", { quantity: 1, unit: "kilogram", byWeight: false }],
    ["930 g", { quantity: 930, unit: "gram", byWeight: false }],
    ["150 gram", { quantity: 150, unit: "gram", byWeight: false }],
    ["per kg", { quantity: 1, unit: "kilogram", byWeight: true }],
    ["per kilo", { quantity: 1, unit: "kilogram", byWeight: true }],
    ["per 100 gram", { quantity: 100, unit: "gram", byWeight: true }],
    ["/ kg", { quantity: 1, unit: "kilogram", byWeight: true }],
    ["per 500 ml", { quantity: 500, unit: "milliliter", byWeight: true }],
  ])("reads %s", (words, expected) => {
    expect(readPackSize(words)).toEqual(expected);
  });

  it("reads nothing from words the table does not know, or from no words", () => {
    for (const words of ["Tros", "per pakket", "2-pakket", "groot", "", "  ", "12"]) {
      expect(readPackSize(words), words).toBeNull();
    }
    expect(readPackSize(null)).toBeNull();
    expect(readPackSize(undefined)).toBeNull();
  });

  it("reads a container as no Pack Size: two packs is not what one pack holds", () => {
    expect(readPackSize("2 pak")).toBeNull();
  });
});

describe("packSizeFromCode", () => {
  it("reads a quantity with a UN/CEFACT code ahead of any words", () => {
    expect(packSizeFromCode(500, "GRM")).toEqual({
      quantity: 500,
      unit: "gram",
      byWeight: false,
    });
    expect(packSizeFromCode("1.5", "LTR")).toEqual({
      quantity: 1.5,
      unit: "liter",
      byWeight: false,
    });
    expect(packSizeFromCode("10", "H87")).toEqual({
      quantity: 10,
      unit: "piece",
      byWeight: false,
    });
  });

  it("reads a unit written as text where there is no code", () => {
    expect(packSizeFromCode(250, "ml")).toEqual({
      quantity: 250,
      unit: "milliliter",
      byWeight: false,
    });
  });

  it("reads nothing from a code it does not know, or a quantity that is not a number", () => {
    expect(packSizeFromCode(500, "XYZ")).toBeNull();
    expect(packSizeFromCode("veel", "GRM")).toBeNull();
    expect(packSizeFromCode(500, null)).toBeNull();
  });
});
