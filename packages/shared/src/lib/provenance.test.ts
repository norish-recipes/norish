import { describe, expect, it } from "vitest";

import {
  countryCodeToFlagEmoji,
  getLocalizedCountryName,
  isValidCountryCode,
  MAX_CUISINE_LABELS,
  normalizeCuisines,
  normalizeRecipeProvenance,
  recipeHasProvenance,
} from "./provenance";

describe("isValidCountryCode", () => {
  it("accepts real ISO 3166-1 alpha-2 codes case-insensitively", () => {
    expect(isValidCountryCode("IT")).toBe(true);
    expect(isValidCountryCode("it")).toBe(true);
    expect(isValidCountryCode("JP")).toBe(true);
    expect(isValidCountryCode("us")).toBe(true);
  });

  it("rejects malformed and unassigned codes", () => {
    expect(isValidCountryCode("")).toBe(false);
    expect(isValidCountryCode("I")).toBe(false);
    expect(isValidCountryCode("ITA")).toBe(false);
    expect(isValidCountryCode("12")).toBe(false);
    expect(isValidCountryCode("XX")).toBe(false);
  });
});

describe("countryCodeToFlagEmoji", () => {
  it("derives the regional-indicator flag for a valid code", () => {
    expect(countryCodeToFlagEmoji("IT")).toBe("🇮🇹");
    expect(countryCodeToFlagEmoji("jp")).toBe("🇯🇵");
  });

  it("returns null for an invalid code", () => {
    expect(countryCodeToFlagEmoji("XX")).toBeNull();
    expect(countryCodeToFlagEmoji("ITA")).toBeNull();
    expect(countryCodeToFlagEmoji(null)).toBeNull();
  });
});

describe("getLocalizedCountryName", () => {
  it("localizes a valid code to the requested locale", () => {
    expect(getLocalizedCountryName("IT", "en")).toBe("Italy");
    expect(getLocalizedCountryName("IT", "it")).toBe("Italia");
  });

  it("returns null for an invalid code", () => {
    expect(getLocalizedCountryName("XX", "en")).toBeNull();
    expect(getLocalizedCountryName(null, "en")).toBeNull();
  });
});

describe("recipeHasProvenance", () => {
  it("is true when any provenance field is set", () => {
    expect(recipeHasProvenance({ originCountryCode: "IT" })).toBe(true);
    expect(recipeHasProvenance({ region: "Sicily" })).toBe(true);
    expect(recipeHasProvenance({ cuisines: ["Italian"] })).toBe(true);
    expect(recipeHasProvenance({ provenanceNote: "A note." })).toBe(true);
  });

  it("is false when the recipe carries no provenance (tolerating a partial DTO)", () => {
    expect(recipeHasProvenance({})).toBe(false);
    expect(
      recipeHasProvenance({
        originCountryCode: null,
        region: null,
        cuisines: [],
        provenanceNote: null,
      })
    ).toBe(false);
  });
});

describe("normalizeCuisines", () => {
  it("trims, drops empties, and deduplicates case-insensitively while keeping first casing", () => {
    expect(normalizeCuisines(["  Italian  ", "italian", "", "  ", "Sicilian"])).toEqual([
      "Italian",
      "Sicilian",
    ]);
  });

  it("bounds the number of labels", () => {
    const many = Array.from({ length: MAX_CUISINE_LABELS + 5 }, (_, i) => `Cuisine ${i}`);

    expect(normalizeCuisines(many)).toHaveLength(MAX_CUISINE_LABELS);
  });

  it("ignores non-string entries defensively", () => {
    expect(normalizeCuisines(["Thai", null as unknown as string, 3 as unknown as string])).toEqual([
      "Thai",
    ]);
  });
});

describe("normalizeRecipeProvenance", () => {
  it("normalizes a well-formed inference result", () => {
    expect(
      normalizeRecipeProvenance({
        originCountryCode: "it",
        region: "  Emilia-Romagna  ",
        cuisines: ["Italian", "italian"],
        note: "  A classic baked pasta dish.  ",
      })
    ).toEqual({
      originCountryCode: "IT",
      region: "Emilia-Romagna",
      cuisines: ["Italian"],
      note: "A classic baked pasta dish.",
    });
  });

  it("coerces an invalid or unknown country to null without discarding the rest", () => {
    expect(
      normalizeRecipeProvenance({
        originCountryCode: "Atlantis",
        region: null,
        cuisines: ["Fusion"],
        note: "Origin uncertain.",
      })
    ).toEqual({
      originCountryCode: null,
      region: null,
      cuisines: ["Fusion"],
      note: "Origin uncertain.",
    });
  });

  it("maps empty strings and missing values to null / empty list", () => {
    expect(
      normalizeRecipeProvenance({
        originCountryCode: null,
        region: "   ",
        cuisines: [],
        note: "   ",
      })
    ).toEqual({
      originCountryCode: null,
      region: null,
      cuisines: [],
      note: null,
    });
  });
});
