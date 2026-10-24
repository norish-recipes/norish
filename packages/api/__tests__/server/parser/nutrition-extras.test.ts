import { describe, expect, it } from "vitest";

import { extractNutrition, parseMilligrams } from "@norish/api/parser/parsers/nutrition";

describe("the nutrients a source states beyond the four", () => {
  it("reads schema.org's other nutrients per serving, sodium and cholesterol in milligrams", () => {
    expect(
      extractNutrition({
        nutrition: {
          calories: "420 kcal",
          fatContent: "12 g",
          saturatedFatContent: "4.5 g",
          sugarContent: "9 g",
          fiberContent: "6 g",
          sodiumContent: "0.6 g",
          cholesterolContent: "35 mg",
        },
      }).extras
    ).toEqual({ saturatedFat: 4.5, sugars: 9, fiber: 6, sodium: 600, cholesterol: 35 });
  });

  it("reads the short names the AI extraction answers with", () => {
    expect(
      extractNutrition({ nutrition: { calories: 300, fiber: 4, sodium: 380, sugars: null } }).extras
    ).toEqual({ fiber: 4, sodium: 380 });
  });

  it("states none where the source states none", () => {
    expect(extractNutrition({ nutrition: { calories: "300 kcal" } }).extras).toBeNull();
  });

  it.each([
    ["480 mg", 480],
    ["0.48 g", 480],
    ["480", 480],
    ["1200 µg", 1.2],
    [480, 480],
  ])("reads %j as %j milligrams", (raw, mg) => {
    expect(parseMilligrams(raw)).toBe(mg);
  });
});
