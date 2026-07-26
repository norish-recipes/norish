import { describe, expect, it } from "vitest";

import {
  ENRICHMENT_KINDS,
  hasSubstantiveCategories,
  hasSubstantiveNutrition,
  normalizeEnrichmentTagNames,
  normalizeNutritionGroup,
  toEnrichmentLifecycleState,
} from "@norish/shared/lib/recipe-enrichment";

describe("ENRICHMENT_KINDS", () => {
  it("names the four independent enrichment kinds", () => {
    expect([...ENRICHMENT_KINDS]).toEqual([
      "auto-tagging",
      "allergy-detection",
      "auto-categorization",
      "nutrition-estimation",
    ]);
  });
});

describe("hasSubstantiveCategories", () => {
  it("treats an absent, null, or empty list as absent", () => {
    expect(hasSubstantiveCategories(undefined)).toBe(false);
    expect(hasSubstantiveCategories(null)).toBe(false);
    expect(hasSubstantiveCategories([])).toBe(false);
  });

  it("treats blank and whitespace-only entries as absent", () => {
    expect(hasSubstantiveCategories(["", "   ", "\t\n"])).toBe(false);
  });

  it("treats any substantive category as present", () => {
    expect(hasSubstantiveCategories(["Dinner"])).toBe(true);
    expect(hasSubstantiveCategories(["", "Snack"])).toBe(true);
  });
});

describe("hasSubstantiveNutrition", () => {
  it("treats an entirely absent group as absent", () => {
    expect(hasSubstantiveNutrition({})).toBe(false);
    expect(hasSubstantiveNutrition({ calories: null, fat: null, carbs: null, protein: null })).toBe(
      false
    );
  });

  it("treats blank and whitespace-only strings as absent", () => {
    expect(hasSubstantiveNutrition({ fat: "", carbs: "   ", protein: "\n" })).toBe(false);
  });

  it("treats zero as a substantive supplied value", () => {
    expect(hasSubstantiveNutrition({ calories: 0 })).toBe(true);
    expect(hasSubstantiveNutrition({ fat: "0" })).toBe(true);
  });

  it("treats any single substantive field as making the whole group present", () => {
    expect(hasSubstantiveNutrition({ protein: "12" })).toBe(true);
    expect(hasSubstantiveNutrition({ calories: 240, fat: null, carbs: null, protein: null })).toBe(
      true
    );
  });

  it("ignores non-numeric noise", () => {
    expect(hasSubstantiveNutrition({ fat: "unknown" })).toBe(false);
  });
});

describe("normalizeNutritionGroup", () => {
  it("normalizes blanks to null across the whole group", () => {
    expect(
      normalizeNutritionGroup({ calories: null, fat: "  ", carbs: "", protein: undefined })
    ).toEqual({ calories: null, fat: null, carbs: null, protein: null });
  });

  it("keeps substantive values and nulls the rest", () => {
    expect(normalizeNutritionGroup({ calories: 240, fat: "9.5" })).toEqual({
      calories: 240,
      fat: "9.5",
      carbs: null,
      protein: null,
    });
  });

  it("rounds calories to an integer and rejects negative values", () => {
    expect(normalizeNutritionGroup({ calories: 240.6, fat: -3 })).toEqual({
      calories: 241,
      fat: null,
      carbs: null,
      protein: null,
    });
  });
});

describe("normalizeEnrichmentTagNames", () => {
  it("drops blank entries and trims whitespace", () => {
    expect(normalizeEnrichmentTagNames([" vegan ", "", "   ", "quick"])).toEqual([
      "vegan",
      "quick",
    ]);
  });

  it("deduplicates case-insensitively, keeping the first spelling", () => {
    expect(normalizeEnrichmentTagNames(["Vegan", "vegan", "VEGAN"])).toEqual(["Vegan"]);
  });
});

describe("toEnrichmentLifecycleState", () => {
  it("maps accepted BullMQ states to queued", () => {
    expect(toEnrichmentLifecycleState("waiting")).toBe("queued");
    expect(toEnrichmentLifecycleState("delayed")).toBe("queued");
    expect(toEnrichmentLifecycleState("prioritized")).toBe("queued");
    expect(toEnrichmentLifecycleState("waiting-children")).toBe("queued");
  });

  it("maps active to processing", () => {
    expect(toEnrichmentLifecycleState("active")).toBe("processing");
  });

  it("maps completed to succeeded and failed to failed", () => {
    expect(toEnrichmentLifecycleState("completed")).toBe("succeeded");
    expect(toEnrichmentLifecycleState("failed")).toBe("failed");
  });

  it("maps a missing or unknown job to idle", () => {
    expect(toEnrichmentLifecycleState(null)).toBe("idle");
    expect(toEnrichmentLifecycleState("unknown")).toBe("idle");
  });
});
