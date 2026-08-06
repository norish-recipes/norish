import { describe, expect, it } from "vitest";

import {
  ENRICHMENT_KINDS,
  fillProvenanceGaps,
  hasCompleteProvenance,
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
  it("names the six independent enrichment kinds", () => {
    expect([...ENRICHMENT_KINDS]).toEqual([
      "auto-tagging",
      "allergy-detection",
      "auto-categorization",
      "nutrition-estimation",
      "recipe-provenance",
      "ingredient-linking",
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

describe("hasCompleteProvenance", () => {
  it("requires a country, a note, and at least one Cuisine", () => {
    expect(
      hasCompleteProvenance({
        originCountry: "IT",
        provenanceNote: "A Roman classic.",
        cuisines: [{ name: "Italian" }],
      })
    ).toBe(true);
    expect(hasCompleteProvenance({ originCountry: "IT", provenanceNote: "A Roman classic." })).toBe(
      false
    );
    expect(hasCompleteProvenance({ originCountry: "IT", cuisines: ["Italian"] })).toBe(false);
    expect(
      hasCompleteProvenance({ provenanceNote: "A Roman classic.", cuisines: ["Italian"] })
    ).toBe(false);
  });

  it("does not count the region: its absence is a valid answer", () => {
    expect(
      hasCompleteProvenance({
        originCountry: "IT",
        originRegion: null,
        provenanceNote: "A national dish.",
        cuisines: ["Italian"],
      })
    ).toBe(true);
    // A region alone completes nothing.
    expect(hasCompleteProvenance({ originRegion: "Lazio" })).toBe(false);
  });

  it("does not count the written country name: the endonym fallback covers it", () => {
    expect(
      hasCompleteProvenance({
        originCountry: "IT",
        originCountryName: null,
        provenanceNote: "Note.",
        cuisines: ["Italian"],
      })
    ).toBe(true);
  });

  it("treats blank and malformed values as absent", () => {
    expect(
      hasCompleteProvenance({
        originCountry: "Italy",
        provenanceNote: "Note.",
        cuisines: ["Italian"],
      })
    ).toBe(false);
    expect(
      hasCompleteProvenance({ originCountry: "IT", provenanceNote: "  ", cuisines: ["Italian"] })
    ).toBe(false);
  });
});

describe("fillProvenanceGaps", () => {
  const CLAIM = {
    originCountry: "IT",
    originCountryName: "Italia",
    originRegion: "Lazio",
    provenanceNote: "Una classica ricetta romana.",
    cuisines: ["id-italian"],
  };

  it("fills every slot of an empty group", () => {
    const fill = fillProvenanceGaps({}, CLAIM);

    expect(fill).toEqual({
      group: {
        originCountry: "IT",
        originCountryName: "Italia",
        originRegion: "Lazio",
        provenanceNote: "Una classica ricetta romana.",
      },
      fillCuisines: true,
      changed: true,
    });
  });

  it("fills the scalars around a supplied Cuisine and keeps the Cuisine set", () => {
    // The complaint that motivated ADR-0018: one supplied Cuisine used to
    // suppress the whole group.
    const fill = fillProvenanceGaps({ cuisines: [{ name: "Italian" }] }, CLAIM);

    expect(fill.group).toEqual({
      originCountry: "IT",
      originCountryName: "Italia",
      originRegion: "Lazio",
      provenanceNote: "Una classica ricetta romana.",
    });
    expect(fill.fillCuisines).toBe(false);
    expect(fill.changed).toBe(true);
  });

  it("keeps a supplied note byte-for-byte and fills the rest", () => {
    const fill = fillProvenanceGaps({ provenanceNote: "  My grandmother's, from Rome. " }, CLAIM);

    expect(fill.group.provenanceNote).toBe("  My grandmother's, from Rome. ");
    expect(fill.group.originCountry).toBe("IT");
    expect(fill.fillCuisines).toBe(true);
    expect(fill.changed).toBe(true);
  });

  it("changes nothing when the stored group is complete, even without a region", () => {
    const stored = {
      originCountry: "NL",
      originCountryName: null,
      originRegion: null,
      provenanceNote: "Set by an editor.",
      cuisines: ["id-dutch"],
    };

    const fill = fillProvenanceGaps(stored, CLAIM);

    expect(fill.changed).toBe(false);
    expect(fill.fillCuisines).toBe(false);
    // No region sneaks in beside a group a person finished.
    expect(fill.group.originRegion).toBeNull();
  });

  it("refuses claim scalars beside a supplied country the claim disagrees with", () => {
    const fill = fillProvenanceGaps({ originCountry: "NL" }, CLAIM);

    // The claim's region and note argue for Italy; storing them beside NL
    // would put a paragraph next to a field it contradicts.
    expect(fill.group).toEqual({
      originCountry: "NL",
      originCountryName: null,
      originRegion: null,
      provenanceNote: null,
    });
    // Cuisines are not country-bound, so they still fill.
    expect(fill.fillCuisines).toBe(true);
    expect(fill.changed).toBe(true);
  });

  it("defers entirely when a disagreeing claim brings no Cuisines either", () => {
    const fill = fillProvenanceGaps({ originCountry: "NL" }, { ...CLAIM, cuisines: [] });

    expect(fill.changed).toBe(false);
  });

  it("fills the name, region, and note beside a supplied country the claim agrees with", () => {
    const claim = {
      originCountry: "NL",
      originCountryName: "Nederland",
      originRegion: "Friesland",
      provenanceNote: "Een Friese klassieker.",
      cuisines: [],
    };

    const fill = fillProvenanceGaps({ originCountry: "NL", cuisines: ["id-dutch"] }, claim);

    expect(fill.group).toEqual({
      originCountry: "NL",
      originCountryName: "Nederland",
      originRegion: "Friesland",
      provenanceNote: "Een Friese klassieker.",
    });
    expect(fill.fillCuisines).toBe(false);
    expect(fill.changed).toBe(true);
  });

  it("keeps a supplied written name even while filling other slots", () => {
    const fill = fillProvenanceGaps(
      { originCountry: "IT", originCountryName: "Italië" },
      { ...CLAIM, cuisines: [] }
    );

    expect(fill.group.originCountryName).toBe("Italië");
    expect(fill.group.provenanceNote).toBe("Una classica ricetta romana.");
  });

  it("treats blank and malformed stored values as gaps", () => {
    const fill = fillProvenanceGaps(
      { originCountry: "Italy", originRegion: "  ", provenanceNote: "" },
      CLAIM
    );

    expect(fill.group).toEqual({
      originCountry: "IT",
      originCountryName: "Italia",
      originRegion: "Lazio",
      provenanceNote: "Una classica ricetta romana.",
    });
    expect(fill.changed).toBe(true);
  });

  it("fills the note of an unplaceable dish only while no country is supplied", () => {
    const unplaceable = {
      originCountry: null,
      originCountryName: null,
      originRegion: null,
      provenanceNote: "Dit gerecht is niet aan één land te koppelen.",
      cuisines: [],
    };

    // No country stored, none claimed: the explanation of the honest blank fills.
    expect(fillProvenanceGaps({}, unplaceable).group.provenanceNote).toBe(
      "Dit gerecht is niet aan één land te koppelen."
    );
    // A supplied country contradicts "unplaceable": the note stays out.
    expect(fillProvenanceGaps({ originCountry: "NL" }, unplaceable).changed).toBe(false);
  });

  it("reports no change for a claim with nothing left to give", () => {
    const fill = fillProvenanceGaps(
      { originCountry: "IT", provenanceNote: "Stored." },
      { originCountry: "IT", originCountryName: null, originRegion: null, provenanceNote: "New." }
    );

    expect(fill.changed).toBe(false);
    expect(fill.group.provenanceNote).toBe("Stored.");
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
  it("treats an entirely absent group as not substantive", () => {
    expect(hasSubstantiveNutrition({})).toBe(false);
    expect(hasSubstantiveNutrition({ calories: null, fat: null, carbs: null, protein: null })).toBe(
      false
    );
  });

  it("requires the whole group: a partial group is not substantive", () => {
    expect(hasSubstantiveNutrition({ protein: "12" })).toBe(false);
    expect(hasSubstantiveNutrition({ calories: 240, fat: null, carbs: null, protein: null })).toBe(
      false
    );
    expect(hasSubstantiveNutrition({ calories: 240, fat: "9", carbs: "30" })).toBe(false);
  });

  it("treats a complete group as substantive", () => {
    expect(hasSubstantiveNutrition({ calories: 240, fat: "9", carbs: "30", protein: "12" })).toBe(
      true
    );
  });

  it("counts zero as a value, not as absence", () => {
    expect(hasSubstantiveNutrition({ calories: 4, fat: "0", carbs: "1", protein: "0" })).toBe(true);
    expect(hasSubstantiveNutrition({ calories: 0, fat: 0, carbs: 0, protein: 0 })).toBe(true);
  });

  it("treats blank strings and non-numeric noise as absence", () => {
    expect(hasSubstantiveNutrition({ calories: 240, fat: "", carbs: "30", protein: "12" })).toBe(
      false
    );
    expect(
      hasSubstantiveNutrition({ calories: 240, fat: "unknown", carbs: "30", protein: "12" })
    ).toBe(false);
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
