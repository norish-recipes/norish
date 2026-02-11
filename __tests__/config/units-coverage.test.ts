/**
 * Units Configuration Coverage Tests
 *
 * Comprehensive validation of units.default.json structure and locale coverage.
 */

import { describe, it, expect } from "vitest";

import defaultUnits from "@/config/units.default.json";

describe("Units Configuration Coverage", () => {
  const units = defaultUnits as Record<
    string,
    {
      short: Array<{ locale: string; name: string }>;
      plural: Array<{ locale: string; name: string }>;
      alternates: string[];
    }
  >;

  const unitKeys = Object.keys(units);

  describe("Structure validation", () => {
    it.each(unitKeys)("unit '%s' has required fields", (key) => {
      expect(units[key]).toHaveProperty("short");
      expect(units[key]).toHaveProperty("plural");
      expect(units[key]).toHaveProperty("alternates");
    });

    it.each(unitKeys)("unit '%s' has short field as array", (key) => {
      expect(Array.isArray(units[key].short)).toBe(true);
      expect(units[key].short.length).toBeGreaterThan(0);
    });

    it.each(unitKeys)("unit '%s' has plural field as array", (key) => {
      expect(Array.isArray(units[key].plural)).toBe(true);
      expect(units[key].plural.length).toBeGreaterThan(0);
    });

    it.each(unitKeys)("unit '%s' has alternates field as array", (key) => {
      expect(Array.isArray(units[key].alternates)).toBe(true);
    });
  });

  describe("Locale arrays structure", () => {
    it.each(unitKeys)("unit '%s' short entries have locale and name", (key) => {
      for (const entry of units[key].short) {
        expect(entry).toHaveProperty("locale");
        expect(entry).toHaveProperty("name");
        expect(typeof entry.locale).toBe("string");
        expect(typeof entry.name).toBe("string");
        expect(entry.locale.length).toBe(2); // ISO 639-1 codes
      }
    });

    it.each(unitKeys)("unit '%s' plural entries have locale and name", (key) => {
      for (const entry of units[key].plural) {
        expect(entry).toHaveProperty("locale");
        expect(entry).toHaveProperty("name");
        expect(typeof entry.locale).toBe("string");
        expect(typeof entry.name).toBe("string");
        expect(entry.locale.length).toBe(2); // ISO 639-1 codes
      }
    });
  });

  describe("English locale coverage", () => {
    it.each(unitKeys)("unit '%s' has English short form", (key) => {
      const hasEnglish = units[key].short.some((entry) => entry.locale === "en");

      expect(hasEnglish).toBe(true);
    });

    it.each(unitKeys)("unit '%s' has English plural form", (key) => {
      const hasEnglish = units[key].plural.some((entry) => entry.locale === "en");

      expect(hasEnglish).toBe(true);
    });
  });

  describe("German locale coverage", () => {
    it.each(unitKeys)("unit '%s' has German short form", (key) => {
      const hasGerman = units[key].short.some((entry) => entry.locale === "de");

      expect(hasGerman).toBe(true);
    });

    it.each(unitKeys)("unit '%s' has German plural form", (key) => {
      const hasGerman = units[key].plural.some((entry) => entry.locale === "de");

      expect(hasGerman).toBe(true);
    });
  });

  describe("Key conventions", () => {
    it.each(unitKeys)("unit key '%s' is lowercase or snake_case", (key) => {
      // Allow lowercase, underscores, but no uppercase or special chars
      expect(key).toMatch(/^[a-z0-9_]+$/);
    });

    it("has no duplicate unit keys", () => {
      const keys = Object.keys(units);
      const uniqueKeys = new Set(keys);

      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe("Coverage report", () => {
    it("reports total unit count", () => {
      expect(unitKeys.length).toBeGreaterThan(0);
    });

    it("reports supported locales", () => {
      const locales = new Set<string>();

      for (const key of unitKeys) {
        for (const entry of units[key].short) {
          locales.add(entry.locale);
        }
      }
      expect(locales.size).toBeGreaterThan(0);
    });

    it("verifies German coverage is 100%", () => {
      const totalUnits = unitKeys.length;
      const germanUnits = unitKeys.filter((key) =>
        units[key].short.some((entry) => entry.locale === "de")
      );
      const coverage = (germanUnits.length / totalUnits) * 100;

      expect(coverage).toBe(100);
    });
  });
});
