/**
 * Unit Localization Tests
 *
 * Tests for the ACTUAL production code used in the app:
 * - normalizeUnit: converts user input => canonical ID (used when saving ingredients)
 * - formatUnit: converts canonical ID => localized display (used in UI)
 * - flattenForLibrary: prepares config for parse-ingredient library
 */

import type { UnitsMap } from "@/server/db/zodSchemas/server-config";

import { describe, it, expect } from "vitest";

import { flattenForLibrary, normalizeUnit, formatUnit } from "@/lib/unit-localization";
import defaultUnits from "@/config/units.default.json";

const unitsConfig = defaultUnits as UnitsMap;

describe("Unit Localization", () => {
  describe("normalizeUnit - input => canonical ID", () => {
    it("normalizes German 'EL' to canonical 'tablespoon'", () => {
      expect(normalizeUnit("EL", unitsConfig)).toBe("tablespoon");
    });

    it("normalizes German 'TL' to canonical 'teaspoon'", () => {
      expect(normalizeUnit("TL", unitsConfig)).toBe("teaspoon");
    });

    it("normalizes Dutch 'el' to canonical 'tablespoon'", () => {
      expect(normalizeUnit("el", unitsConfig)).toBe("tablespoon");
    });

    it("normalizes alternate 'gr' to canonical 'gram'", () => {
      expect(normalizeUnit("gr", unitsConfig)).toBe("gram");
    });

    it("normalizes English 'tbsp' to canonical 'tablespoon'", () => {
      expect(normalizeUnit("tbsp", unitsConfig)).toBe("tablespoon");
    });

    it("returns canonical ID unchanged", () => {
      expect(normalizeUnit("gram", unitsConfig)).toBe("gram");
      expect(normalizeUnit("tablespoon", unitsConfig)).toBe("tablespoon");
    });

    it("returns unknown units as-is", () => {
      expect(normalizeUnit("unknownUnit", unitsConfig)).toBe("unknownUnit");
    });

    it("handles empty string", () => {
      expect(normalizeUnit("", unitsConfig)).toBe("");
    });
  });

  describe("formatUnit - canonical ID => localized display", () => {
    describe("German locale (de)", () => {
      it("formats 'gram' as 'g'", () => {
        expect(formatUnit("gram", "de", unitsConfig)).toBe("g");
      });

      it("formats 'tablespoon' as 'EL'", () => {
        expect(formatUnit("tablespoon", "de", unitsConfig)).toBe("EL");
      });

      it("formats 'teaspoon' as 'TL'", () => {
        expect(formatUnit("teaspoon", "de", unitsConfig)).toBe("TL");
      });
    });

    describe("English locale (en)", () => {
      it("formats 'gram' as 'g'", () => {
        expect(formatUnit("gram", "en", unitsConfig)).toBe("g");
      });

      it("formats 'tablespoon' as 'tbsp'", () => {
        expect(formatUnit("tablespoon", "en", unitsConfig)).toBe("tbsp");
      });
    });

    describe("Dutch locale (nl)", () => {
      it("formats 'tablespoon' as 'el'", () => {
        expect(formatUnit("tablespoon", "nl", unitsConfig)).toBe("el");
      });

      it("formats 'teaspoon' as 'tl'", () => {
        expect(formatUnit("teaspoon", "nl", unitsConfig)).toBe("tl");
      });
    });

    describe("Locale variants", () => {
      it("normalizes de-formal to de", () => {
        expect(formatUnit("tablespoon", "de-formal", unitsConfig)).toBe("EL");
      });

      it("normalizes de-informal to de", () => {
        expect(formatUnit("tablespoon", "de-informal", unitsConfig)).toBe("EL");
      });
    });

    describe("Fallback behavior", () => {
      it("falls back to English for unknown locale", () => {
        expect(formatUnit("tablespoon", "es", unitsConfig)).toBe("tbsp");
        expect(formatUnit("tablespoon", "ja", unitsConfig)).toBe("tbsp");
      });

      it("returns unitId for unknown units", () => {
        expect(formatUnit("unknownUnit", "de", unitsConfig)).toBe("unknownUnit");
      });
    });
  });

  describe("flattenForLibrary - prepare config for parser", () => {
    it("flattens locale-aware config to simple format", () => {
      const flattened = flattenForLibrary(unitsConfig);

      expect(flattened.gram).toEqual({
        short: "g",
        plural: "grams", // Different from short - parser needs both forms
        alternates: expect.arrayContaining(["gr", "grammen"]),
      });
    });

    it("provides both short and plural forms for parser", () => {
      const flattened = flattenForLibrary(unitsConfig);

      // Parser needs BOTH forms to recognize "2 tbsp" AND "2 tablespoons"
      expect(flattened.tablespoon.short).toBe("tbsp");
      expect(flattened.tablespoon.plural).toBe("tablespoons");
    });

    it("preserves alternates array", () => {
      const flattened = flattenForLibrary(unitsConfig);

      expect(Array.isArray(flattened.gram.alternates)).toBe(true);
    });
  });
});
