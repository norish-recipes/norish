import { describe, expect, it } from "vitest";

import {
  ENRICHMENT_KINDS,
  hasSubstantiveCategories,
  hasSubstantiveNutrition,
  hasSubstantiveProvenance,
  isRecipeEnrichmentLifecycleEvent,
  normalizeEnrichmentTagNames,
  normalizeNutritionGroup,
  normalizeOriginCountry,
  normalizeProvenanceGroup,
  toEnrichmentLifecycleState,
} from "@norish/shared/lib/recipe-enrichment";

describe("ENRICHMENT_KINDS", () => {
  it("names the five independent enrichment kinds", () => {
    expect([...ENRICHMENT_KINDS]).toEqual([
      "auto-tagging",
      "allergy-detection",
      "auto-categorization",
      "nutrition-estimation",
      "recipe-provenance",
    ]);
  });
});

describe("normalizeOriginCountry", () => {
  it("uppercases a two-letter code", () => {
    expect(normalizeOriginCountry("it")).toBe("IT");
    expect(normalizeOriginCountry(" jp ")).toBe("JP");
  });

  it("discards anything that is not an alpha-2 code", () => {
    // The country is stored as a code, never a display name, so a name is not
    // a country the client can render a flag for.
    expect(normalizeOriginCountry("Italy")).toBeNull();
    expect(normalizeOriginCountry("ITA")).toBeNull();
    expect(normalizeOriginCountry("")).toBeNull();
    expect(normalizeOriginCountry(null)).toBeNull();
  });
});

describe("hasSubstantiveProvenance", () => {
  it("treats an absent or blank group as absent", () => {
    expect(hasSubstantiveProvenance({})).toBe(false);
    expect(
      hasSubstantiveProvenance({
        originCountry: null,
        originRegion: "  ",
        provenanceNote: "\n",
        cuisines: [],
      })
    ).toBe(false);
  });

  it("treats any single substantive field as making the whole group authoritative", () => {
    expect(hasSubstantiveProvenance({ originCountry: "IT" })).toBe(true);
    expect(hasSubstantiveProvenance({ originRegion: "Lazio" })).toBe(true);
    expect(hasSubstantiveProvenance({ provenanceNote: "A Roman classic." })).toBe(true);
    expect(hasSubstantiveProvenance({ cuisines: [{ name: "Italian" }] })).toBe(true);
    expect(hasSubstantiveProvenance({ cuisines: ["Italian"] })).toBe(true);
  });

  it("does not count a malformed country as substantive", () => {
    expect(hasSubstantiveProvenance({ originCountry: "Italy" })).toBe(false);
  });
});

describe("normalizeProvenanceGroup", () => {
  it("nulls omitted, blank, and malformed fields so replacement cannot mix claims", () => {
    expect(normalizeProvenanceGroup({ originCountry: "Italy", originRegion: "   " })).toEqual({
      originCountry: null,
      originCountryName: null,
      originRegion: null,
      provenanceNote: null,
    });
  });

  it("keeps the note exactly as written apart from surrounding whitespace", () => {
    expect(
      normalizeProvenanceGroup({
        originCountry: "jp",
        originCountryName: " \u65e5\u672c ",
        originRegion: " Kansai ",
        provenanceNote: "  \u3053\u306e\u30ec\u30b7\u30d4\u306f...  ",
      })
    ).toEqual({
      originCountry: "JP",
      originCountryName: "\u65e5\u672c",
      originRegion: "Kansai",
      provenanceNote: "\u3053\u306e\u30ec\u30b7\u30d4\u306f...",
    });
  });

  it("drops a written name whose country code did not survive", () => {
    // The name is the code's companion: a name beside a malformed code would
    // title the card while the flag and the picker disagree.
    expect(
      normalizeProvenanceGroup({ originCountry: "Italy", originCountryName: "Italia" })
    ).toEqual({
      originCountry: null,
      originCountryName: null,
      originRegion: null,
      provenanceNote: null,
    });
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

describe("isRecipeEnrichmentLifecycleEvent", () => {
  it("accepts the complete shared lifecycle vocabulary", () => {
    expect(
      isRecipeEnrichmentLifecycleEvent({
        recipeId: "recipe-1",
        runId: "run-1",
        runSequence: 1,
        kind: "auto-tagging",
        state: "failed",
        origin: "manual",
        requestedByUserId: "user-1",
      })
    ).toBe(true);
  });

  it("accepts a non-failing manual transition without disclosing the requester", () => {
    expect(
      isRecipeEnrichmentLifecycleEvent({
        recipeId: "recipe-1",
        runId: "run-1",
        runSequence: 1,
        kind: "auto-tagging",
        state: "queued",
        origin: "manual",
      })
    ).toBe(true);
  });

  it.each([
    { runId: "" },
    { runSequence: -1 },
    { runSequence: 1.5 },
    { kind: "run-everything" },
    { state: "idle" },
    { state: "finished" },
    { origin: "scheduled" },
    { requestedByUserId: 42 },
    { origin: "manual", state: "failed", requestedByUserId: undefined },
    { origin: "manual", requestedByUserId: "user-1" },
    { origin: "automatic", requestedByUserId: "user-1" },
  ])("rejects payloads outside the lifecycle contract: %o", (override) => {
    expect(
      isRecipeEnrichmentLifecycleEvent({
        recipeId: "recipe-1",
        runId: "run-1",
        runSequence: 1,
        kind: "auto-tagging",
        state: "processing",
        origin: "automatic",
        ...override,
      })
    ).toBe(false);
  });
});
