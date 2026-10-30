// @vitest-environment node
/**
 * The override semantics every prompt surface shares: a stored field is an
 * override exactly when its text differs from the shipped default. Saving and
 * reading both delegate here, so this is where the "saved defaults freeze
 * forever" regression is pinned down.
 */
import { describe, expect, it } from "vitest";

import type { PromptValues } from "@norish/config/zod/server-config";
import {
  isSamePromptText,
  mergeWithDefaults,
  PROMPT_CONFIG_FIELDS,
  pruneToOverrides,
} from "@norish/shared-server/ai/prompts/overrides";

const DEFAULTS: PromptValues = {
  recipeExtraction: "Extract the recipe.",
  imageExtraction: "Extract the recipe from the photos.",
  unitConversion: "Convert the units.",
  nutritionEstimation: "Estimate the nutrition.",
  autoTagging: "Tag the recipe.",
  autoCategorization: "Categorize the recipe.",
  allergyDetection: "Detect the allergens.",
  recipeProvenance: "Infer the provenance.",
  ingredientLinking: "Link the ingredients.",
  ingredientResolution: "Recognise the ingredient.",
  ingredientMatch: "Match the ingredient.",
  imageGenerationBrief: "Write the visual brief.",
  imageGenerationStyle: "Draw the dish.",
  ingredientIconStyle: "Draw the food.",
  ingredientPlainName: "Tidy the name.",
  ingredientSpellingCheck: "Check the spellings.",
  ingredientNutrition: "Estimate the food.",
};

describe("isSamePromptText", () => {
  it("ignores surrounding whitespace and line-ending style", () => {
    expect(isSamePromptText("Extract.\r\nCarefully.\n", "Extract.\nCarefully.")).toBe(true);
    expect(isSamePromptText("Extract.", "Extract!")).toBe(false);
  });
});

describe("pruneToOverrides", () => {
  it("keeps only texts that differ from the shipped defaults", () => {
    expect(pruneToOverrides({ ...DEFAULTS, autoTagging: "My tagging rules" }, DEFAULTS)).toEqual({
      autoTagging: "My tagging rules",
    });
  });

  it("drops blanks and non-strings", () => {
    expect(pruneToOverrides({ recipeExtraction: "   ", unitConversion: 7 }, DEFAULTS)).toEqual({});
  });

  it("keeps an earlier release's wording an administrator saved on purpose", () => {
    const stored = { recipeExtraction: "Extract the recipe (2024 wording)." };

    expect(pruneToOverrides(stored, DEFAULTS)).toEqual(stored);
  });

  it("handles a missing row", () => {
    expect(pruneToOverrides(null, DEFAULTS)).toEqual({});
  });
});

describe("mergeWithDefaults", () => {
  it("serves defaults for every field of an empty or missing row", () => {
    for (const stored of [null, {}]) {
      const { values, overriddenFields } = mergeWithDefaults(stored, DEFAULTS);

      expect(values).toEqual(DEFAULTS);
      expect(overriddenFields).toEqual([]);
    }
  });

  it("lays genuine overrides over the defaults and names them", () => {
    const { values, overriddenFields } = mergeWithDefaults(
      { autoTagging: "My tagging rules", allergyDetection: DEFAULTS.allergyDetection },
      DEFAULTS
    );

    expect(values).toEqual({ ...DEFAULTS, autoTagging: "My tagging rules" });
    expect(overriddenFields).toEqual(["autoTagging"]);
  });

  it("covers every administrator-editable field", () => {
    expect(Object.keys(DEFAULTS).sort()).toEqual([...PROMPT_CONFIG_FIELDS].sort());
  });
});
