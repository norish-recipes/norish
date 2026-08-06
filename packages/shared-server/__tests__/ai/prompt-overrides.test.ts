// @vitest-environment node
/**
 * The override semantics every prompt surface shares: a stored field is an
 * override exactly when its text differs from the shipped default — current
 * or retired. Saving, booting, and reading all delegate here, so this is
 * where the "saved defaults freeze forever" regression is pinned down.
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
};

describe("isSamePromptText", () => {
  it("ignores surrounding whitespace and line-ending style", () => {
    expect(isSamePromptText("Extract.\r\nCarefully.\n", "Extract.\nCarefully.")).toBe(true);
    expect(isSamePromptText("Extract.", "Extract!")).toBe(false);
  });
});

describe("pruneToOverrides", () => {
  it("keeps only texts that differ from the shipped defaults", () => {
    const { overrides, changed } = pruneToOverrides(
      { ...DEFAULTS, autoTagging: "My tagging rules" },
      DEFAULTS
    );

    expect(overrides).toEqual({ autoTagging: "My tagging rules" });
    expect(changed).toBe(true);
  });

  it("drops blanks, non-strings, and the legacy isOverridden flag", () => {
    const { overrides, changed } = pruneToOverrides(
      { recipeExtraction: "   ", unitConversion: 7, isOverridden: true },
      DEFAULTS
    );

    expect(overrides).toEqual({});
    expect(changed).toBe(true);
  });

  it("drops texts matching a retired default, but only when given them", () => {
    const stored = { recipeExtraction: "Extract the recipe (2024 wording)." };
    const retired = { recipeExtraction: ["Extract the recipe (2024 wording)."] };

    expect(pruneToOverrides(stored, DEFAULTS, retired).overrides).toEqual({});
    // The save path passes no retired defaults: an administrator pasting an
    // old wording on purpose keeps it as an override.
    expect(pruneToOverrides(stored, DEFAULTS).overrides).toEqual(stored);
  });

  it("reports an already-clean row as unchanged", () => {
    const stored = { recipeProvenance: "My provenance rules" };
    const { overrides, changed } = pruneToOverrides(stored, DEFAULTS);

    expect(overrides).toEqual(stored);
    expect(changed).toBe(false);
  });

  it("handles a missing row", () => {
    expect(pruneToOverrides(null, DEFAULTS)).toEqual({ overrides: {}, changed: false });
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
