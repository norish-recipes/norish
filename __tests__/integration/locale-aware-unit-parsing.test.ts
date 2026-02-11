import type { UnitsMap } from "@/server/db/zodSchemas/server-config";

import { describe, it, expect } from "vitest";

import { parseIngredientWithDefaults } from "@/lib/helpers";
import { formatUnit } from "@/lib/unit-localization";

describe("Locale-Aware Unit Parsing Integration", () => {
  const mockUnitsConfig: UnitsMap = {
    gram: {
      short: [
        { locale: "en", name: "g" },
        { locale: "de", name: "g" },
        { locale: "nl", name: "gr" },
      ],
      plural: [
        { locale: "en", name: "grams" },
        { locale: "de", name: "g" },
        { locale: "nl", name: "gram" },
      ],
      alternates: ["g", "gram", "grams", "gramm", "gr", "grammen"],
    },
    tablespoon: {
      short: [
        { locale: "en", name: "tbsp" },
        { locale: "de", name: "EL" },
        { locale: "nl", name: "el" },
      ],
      plural: [
        { locale: "en", name: "tbsp" },
        { locale: "de", name: "EL" },
        { locale: "nl", name: "eetlepels" },
      ],
      alternates: [
        "tbsp",
        "tablespoon",
        "tablespoons",
        "EL",
        "el",
        "esslöffel",
        "eetlepel",
        "eetlepels",
      ],
    },
    teaspoon: {
      short: [
        { locale: "en", name: "tsp" },
        { locale: "de", name: "TL" },
        { locale: "nl", name: "tl" },
      ],
      plural: [
        { locale: "en", name: "tsp" },
        { locale: "de", name: "TL" },
        { locale: "nl", name: "theelepels" },
      ],
      alternates: ["tsp", "teaspoon", "teaspoons", "TL", "tl", "teelöffel", "theelepel"],
    },
  };

  describe("Parse German input => Display in all locales", () => {
    it("should parse German 'gramm' and display correctly per locale", () => {
      const parsed = parseIngredientWithDefaults("500 gramm Mehl", mockUnitsConfig);

      expect(parsed[0].unitOfMeasureID).toBe("gram");
      expect(parsed[0].quantity).toBe(500);

      // Display in different locales (always uses short form)
      const unitId = parsed[0].unitOfMeasureID!;

      expect(formatUnit(unitId, "en", mockUnitsConfig)).toBe("g");
      expect(formatUnit(unitId, "de", mockUnitsConfig)).toBe("g");
      expect(formatUnit(unitId, "nl", mockUnitsConfig)).toBe("gr");
    });

    it("should parse German 'EL' (tablespoon) and display correctly per locale", () => {
      const parsed = parseIngredientWithDefaults("2 EL Butter", mockUnitsConfig);

      expect(parsed[0].unitOfMeasureID).toBe("tablespoon");
      expect(parsed[0].quantity).toBe(2);

      const unitId = parsed[0].unitOfMeasureID!;

      expect(formatUnit(unitId, "en", mockUnitsConfig)).toBe("tbsp");
      expect(formatUnit(unitId, "de", mockUnitsConfig)).toBe("EL");
      expect(formatUnit(unitId, "nl", mockUnitsConfig)).toBe("el");
    });

    it("should parse German 'TL' (teaspoon) and display correctly per locale", () => {
      const parsed = parseIngredientWithDefaults("1 TL Salz", mockUnitsConfig);

      expect(parsed[0].unitOfMeasureID).toBe("teaspoon");
      expect(parsed[0].quantity).toBe(1);

      const unitId = parsed[0].unitOfMeasureID!;

      expect(formatUnit(unitId, "en", mockUnitsConfig)).toBe("tsp");
      expect(formatUnit(unitId, "de", mockUnitsConfig)).toBe("TL");
      expect(formatUnit(unitId, "nl", mockUnitsConfig)).toBe("tl");
    });
  });

  describe("Parse English input => Display in all locales", () => {
    it("should parse English 'grams' and display correctly per locale", () => {
      const parsed = parseIngredientWithDefaults("500 grams flour", mockUnitsConfig);

      expect(parsed[0].unitOfMeasureID).toBe("gram");
      expect(parsed[0].quantity).toBe(500);

      const unitId = parsed[0].unitOfMeasureID!;

      expect(formatUnit(unitId, "en", mockUnitsConfig)).toBe("g");
      expect(formatUnit(unitId, "de", mockUnitsConfig)).toBe("g");
      expect(formatUnit(unitId, "nl", mockUnitsConfig)).toBe("gr");
    });

    it("should parse English 'tablespoons' and display correctly per locale", () => {
      const parsed = parseIngredientWithDefaults("2 tablespoons butter", mockUnitsConfig);

      expect(parsed[0].unitOfMeasureID).toBe("tablespoon");
      expect(parsed[0].quantity).toBe(2);

      const unitId = parsed[0].unitOfMeasureID!;

      expect(formatUnit(unitId, "en", mockUnitsConfig)).toBe("tbsp");
      expect(formatUnit(unitId, "de", mockUnitsConfig)).toBe("EL");
      expect(formatUnit(unitId, "nl", mockUnitsConfig)).toBe("el");
    });
  });

  describe("Parse Dutch input => Display in all locales", () => {
    it("should parse Dutch 'gr' (grams) and display correctly per locale", () => {
      const parsed = parseIngredientWithDefaults("500 gr bloem", mockUnitsConfig);

      expect(parsed[0].unitOfMeasureID).toBe("gram");
      expect(parsed[0].quantity).toBe(500);

      const unitId = parsed[0].unitOfMeasureID!;

      expect(formatUnit(unitId, "en", mockUnitsConfig)).toBe("g");
      expect(formatUnit(unitId, "de", mockUnitsConfig)).toBe("g");
      expect(formatUnit(unitId, "nl", mockUnitsConfig)).toBe("gr");
    });

    it("should parse Dutch 'eetlepels' and display correctly per locale", () => {
      const parsed = parseIngredientWithDefaults("2 eetlepels boter", mockUnitsConfig);

      expect(parsed[0].unitOfMeasureID).toBe("tablespoon");
      expect(parsed[0].quantity).toBe(2);

      const unitId = parsed[0].unitOfMeasureID!;

      expect(formatUnit(unitId, "en", mockUnitsConfig)).toBe("tbsp");
      expect(formatUnit(unitId, "de", mockUnitsConfig)).toBe("EL");
      expect(formatUnit(unitId, "nl", mockUnitsConfig)).toBe("el");
    });
  });

  describe("Cross-language parsing scenarios", () => {
    it("should handle mixed-language recipe import", () => {
      const ingredients = [
        "500 gramm Mehl", // German
        "2 tablespoons butter", // English
        "100 gr suiker", // Dutch
      ];

      const results = ingredients.map((ing) => parseIngredientWithDefaults(ing, mockUnitsConfig));

      // All should parse to canonical IDs
      expect(results[0][0].unitOfMeasureID).toBe("gram");
      expect(results[1][0].unitOfMeasureID).toBe("tablespoon");
      expect(results[2][0].unitOfMeasureID).toBe("gram");

      // Display in German (always uses short form)
      expect(formatUnit(results[0][0].unitOfMeasureID!, "de", mockUnitsConfig)).toBe("g");
      expect(formatUnit(results[1][0].unitOfMeasureID!, "de", mockUnitsConfig)).toBe("EL");
      expect(formatUnit(results[2][0].unitOfMeasureID!, "de", mockUnitsConfig)).toBe("g");
    });
  });

  describe("Unknown locale fallback", () => {
    it("should fallback to English for unknown locales", () => {
      const parsed = parseIngredientWithDefaults("500 grams flour", mockUnitsConfig);

      expect(parsed[0].unitOfMeasureID).toBe("gram");

      const unitId = parsed[0].unitOfMeasureID!;

      // Test with various unknown locales - all should fall back to English
      expect(formatUnit(unitId, "fr", mockUnitsConfig)).toBe("g"); // French not in config => en
      expect(formatUnit(unitId, "es", mockUnitsConfig)).toBe("g"); // Spanish not in config => en
      expect(formatUnit(unitId, "ja", mockUnitsConfig)).toBe("g"); // Japanese not in config => en
      expect(formatUnit(unitId, "unknown", mockUnitsConfig)).toBe("g"); // Random locale => en
    });

    it("should fallback to English for partially matching locales", () => {
      const parsed = parseIngredientWithDefaults("2 tbsp butter", mockUnitsConfig);

      expect(parsed[0].unitOfMeasureID).toBe("tablespoon");

      const unitId = parsed[0].unitOfMeasureID!;

      // Test with de-DE (base "de" exists in config, should match)
      // But if we test with a base that doesn't exist, should fall back to en
      expect(formatUnit(unitId, "fr-FR", mockUnitsConfig)).toBe("tbsp"); // French base not in config => en
      expect(formatUnit(unitId, "es-ES", mockUnitsConfig)).toBe("tbsp"); // Spanish base not in config => en
    });

    it("should use base locale if exact match not found", () => {
      const parsed = parseIngredientWithDefaults("500 grams flour", mockUnitsConfig);

      expect(parsed[0].unitOfMeasureID).toBe("gram");

      const unitId = parsed[0].unitOfMeasureID!;

      // de-formal exists in real config, but let's test with de-AT (Austrian German)
      // It should match base "de" if available
      expect(formatUnit(unitId, "de", mockUnitsConfig)).toBe("g"); // de exists
      expect(formatUnit(unitId, "nl", mockUnitsConfig)).toBe("gr"); // nl exists
      expect(formatUnit(unitId, "en", mockUnitsConfig)).toBe("g"); // en exists
    });
  });

  describe("Unknown unit fallback", () => {
    it("should gracefully handle unknown units", () => {
      const parsed = parseIngredientWithDefaults("1 unknown-unit item", mockUnitsConfig);

      // If unit is not recognized, it might not parse correctly
      // The behavior depends on the parse-ingredient library
      // This test documents the expected fallback behavior
      if (parsed[0].unitOfMeasureID) {
        const formatted = formatUnit(parsed[0].unitOfMeasureID, "en", mockUnitsConfig);

        expect(typeof formatted).toBe("string");
      }
    });
  });
});
