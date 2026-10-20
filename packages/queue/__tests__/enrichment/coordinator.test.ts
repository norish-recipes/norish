import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";
import { ENHANCED_ENRICHMENT_KINDS } from "@norish/shared/lib/recipe-enrichment";

const getRecipeFull = vi.fn();
const getHouseholdMemberIds = vi.fn();
const getAllergiesForUsers = vi.fn();
const isAIEnabled = vi.fn();
const getAutomaticEnrichmentConfig = vi.fn();
const isImageGenerationConfigured = vi.fn();
const addEnrichmentJob = vi.fn();

vi.mock("@norish/db", () => ({
  getRecipeFull,
  getHouseholdMemberIds,
  getAllergiesForUsers,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isAIEnabled,
  getAutomaticEnrichmentConfig,
  isImageGenerationConfigured,
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@norish/queue/registry", () => ({
  getQueueByName: (name: string) => ({ name }),
}));

vi.mock("../../src/enrichment/producer", () => ({ addEnrichmentJob }));

const { enrichRecipe } = await import("../../src/enrichment/coordinator");

const context = {
  recipeId: "recipe-1",
  userId: "user-1",
  householdKey: "household-1",
  householdUserIds: ["user-1"],
};

const ALL_ON = {
  autoTagging: true,
  allergyDetection: true,
  autoCategorization: true,
  nutritionEstimation: true,
  recipeProvenance: true,
  ingredientLinking: true,
  imageGeneration: true,
};

const KIND_COUNT = ENHANCED_ENRICHMENT_KINDS.length;

function recipe(overrides: Record<string, unknown> = {}) {
  return {
    id: "recipe-1",
    name: "Test",
    recipeIngredients: [{ ingredientName: "flour" }],
    steps: [{ step: "Mix the flour in.", systemUsed: "metric", order: 0 }],
    categories: [],
    image: null,
    images: [],
    calories: null,
    fat: null,
    carbs: null,
    protein: null,
    originCountry: null,
    originRegion: null,
    provenanceNote: null,
    cuisines: [],
    ...overrides,
  };
}

function outcome(results: Awaited<ReturnType<typeof enrichRecipe>>, kind: RecipeEnrichmentKind) {
  return results.find((result) => result.kind === kind);
}

beforeEach(() => {
  vi.clearAllMocks();
  getRecipeFull.mockResolvedValue(recipe());
  getHouseholdMemberIds.mockResolvedValue(["user-1"]);
  getAllergiesForUsers.mockResolvedValue(["Milk"]);
  isAIEnabled.mockResolvedValue(true);
  getAutomaticEnrichmentConfig.mockResolvedValue(ALL_ON);
  isImageGenerationConfigured.mockResolvedValue(true);
  addEnrichmentJob.mockImplementation(async (_queue, data) => ({
    kind: data.kind,
    status: "queued",
    jobId: `enrich_${data.kind}_${data.recipeId}`,
  }));
});

describe("automatic enrollment", () => {
  it("enrolls exactly the six Enhanced kinds, never allergy detection", async () => {
    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(results.map((result) => result.kind)).toEqual([...ENHANCED_ENRICHMENT_KINDS]);
    expect(results).toHaveLength(6);
    expect(outcome(results, "allergy-detection")).toBeUndefined();
    expect(results.every((result) => result.status === "queued")).toBe(true);
    expect(addEnrichmentJob).toHaveBeenCalledTimes(KIND_COUNT);
  });

  it("records automatic origin and no requester on the job", async () => {
    await enrichRecipe(context, { origin: "automatic" });

    expect(addEnrichmentJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ origin: "automatic", requestedByUserId: undefined })
    );
  });

  it("skips every kind when AI is globally disabled", async () => {
    isAIEnabled.mockResolvedValue(false);

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(results).toHaveLength(KIND_COUNT);
    expect(results.every((r) => r.status === "skipped" && r.reason === "ai-disabled")).toBe(true);
    expect(addEnrichmentJob).not.toHaveBeenCalled();
  });

  it.each([
    ["autoTagging", "auto-tagging"],
    ["autoCategorization", "auto-categorization"],
    ["nutritionEstimation", "nutrition-estimation"],
    ["recipeProvenance", "recipe-provenance"],
    ["ingredientLinking", "ingredient-linking"],
    ["imageGeneration", "image-generation"],
  ] as const)("skips %s when its automatic switch is off", async (setting, kind) => {
    getAutomaticEnrichmentConfig.mockResolvedValue({ ...ALL_ON, [setting]: false });

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, kind)).toEqual({
      kind,
      status: "skipped",
      reason: "automatic-disabled",
    });
    expect(addEnrichmentJob).toHaveBeenCalledTimes(KIND_COUNT - 1);
  });

  it("skips every kind with insufficient input when the recipe has no ingredients", async () => {
    getRecipeFull.mockResolvedValue(recipe({ recipeIngredients: [] }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(results.every((r) => r.status === "skipped" && r.reason === "insufficient-input")).toBe(
      true
    );
  });

  it("skips Ingredient Linking as insufficient input when the recipe has no steps", async () => {
    getRecipeFull.mockResolvedValue(recipe({ steps: [] }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    // Steps are this kind's raw material; the other kinds are unaffected.
    expect(outcome(results, "ingredient-linking")).toEqual({
      kind: "ingredient-linking",
      status: "skipped",
      reason: "insufficient-input",
    });
    expect(outcome(results, "auto-tagging")?.status).toBe("queued");
  });

  it("never applies supplied-data suppression to Ingredient Linking", async () => {
    // A recipe whose steps already carry links at recipe level is not this
    // coordinator's business: the per-step check in the repository write is
    // the suppression, at the only granularity where it is true.
    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "ingredient-linking")?.status).toBe("queued");
  });

  it("never enrolls allergy detection automatically", async () => {
    getAllergiesForUsers.mockResolvedValue([]);

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "allergy-detection")).toBeUndefined();
    expect(outcome(results, "auto-tagging")?.status).toBe("queued");
  });

  it("skips categorization when a substantive category was supplied", async () => {
    getRecipeFull.mockResolvedValue(recipe({ categories: ["Dinner"] }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "auto-categorization")).toEqual({
      kind: "auto-categorization",
      status: "skipped",
      reason: "supplied-data-present",
    });
  });

  it("treats blank categories as absent", async () => {
    getRecipeFull.mockResolvedValue(recipe({ categories: ["", "   "] }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "auto-categorization")?.status).toBe("queued");
  });

  it("skips nutrition estimation only for a complete supplied group", async () => {
    getRecipeFull.mockResolvedValue(
      recipe({ calories: 240, fat: "9", carbs: "30", protein: "12" })
    );

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "nutrition-estimation")).toEqual({
      kind: "nutrition-estimation",
      status: "skipped",
      reason: "supplied-data-present",
    });
  });

  it("treats supplied zeros as a complete group", async () => {
    getRecipeFull.mockResolvedValue(recipe({ calories: 4, fat: "0", carbs: "1", protein: "0" }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "nutrition-estimation")?.status).toBe("skipped");
  });

  it.each(["calories", "fat", "carbs", "protein"] as const)(
    "queues nutrition estimation when only %s is supplied, because an incomplete group is not authoritative",
    async (field) => {
      getRecipeFull.mockResolvedValue(recipe({ [field]: field === "calories" ? 240 : "12" }));

      const results = await enrichRecipe(context, { origin: "automatic" });

      expect(outcome(results, "nutrition-estimation")?.status).toBe("queued");
    }
  );

  it("treats blank nutrition values as absent", async () => {
    getRecipeFull.mockResolvedValue(recipe({ calories: 240, fat: "  ", carbs: "", protein: "12" }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "nutrition-estimation")?.status).toBe("queued");
  });

  it.each([
    ["originCountry", "IT"],
    ["originRegion", "Lazio"],
    ["provenanceNote", "A Roman classic."],
  ] as const)(
    "queues provenance when only %s is supplied, because the group still has gaps",
    async (field, value) => {
      getRecipeFull.mockResolvedValue(recipe({ [field]: value }));

      const results = await enrichRecipe(context, { origin: "automatic" });

      expect(outcome(results, "recipe-provenance")?.status).toBe("queued");
    }
  );

  it("queues provenance when only a Cuisine is supplied, so the rest gets filled in", async () => {
    getRecipeFull.mockResolvedValue(recipe({ cuisines: [{ id: "id-italian", name: "Italian" }] }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "recipe-provenance")?.status).toBe("queued");
  });

  it("skips provenance when the supplied group is complete", async () => {
    getRecipeFull.mockResolvedValue(
      recipe({
        originCountry: "IT",
        provenanceNote: "A Roman classic.",
        cuisines: [{ id: "id-italian", name: "Italian" }],
      })
    );

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "recipe-provenance")).toEqual({
      kind: "recipe-provenance",
      status: "skipped",
      reason: "supplied-data-present",
    });
  });

  it("does not queue provenance for a complete group that only lacks a region", async () => {
    // "No region" is a valid answer for a national dish, so an absent region
    // alone never warrants an AI request.
    getRecipeFull.mockResolvedValue(
      recipe({
        originCountry: "IT",
        originRegion: null,
        provenanceNote: "A national dish.",
        cuisines: [{ id: "id-italian", name: "Italian" }],
      })
    );

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "recipe-provenance")?.status).toBe("skipped");
  });

  it("treats blank provenance values as absent", async () => {
    getRecipeFull.mockResolvedValue(
      recipe({ originRegion: "  ", provenanceNote: "", cuisines: [] })
    );

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "recipe-provenance")?.status).toBe("queued");
  });

  it("keeps supplied tags from suppressing append work", async () => {
    getRecipeFull.mockResolvedValue(recipe({ tags: [{ name: "supplied" }] }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "auto-tagging")?.status).toBe("queued");
  });

  it("reports a duplicate without failing the other kinds", async () => {
    addEnrichmentJob.mockImplementation(async (_queue, data) =>
      data.kind === "auto-tagging"
        ? { kind: data.kind, status: "duplicate", existingJobId: "existing" }
        : { kind: data.kind, status: "queued", jobId: "job" }
    );

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "auto-tagging")?.status).toBe("duplicate");
    expect(outcome(results, "nutrition-estimation")?.status).toBe("queued");
  });

  it("keeps enrolling siblings when one producer throws", async () => {
    addEnrichmentJob.mockImplementation(async (_queue, data) => {
      if (data.kind === "auto-tagging") throw new Error("redis is down");

      return { kind: data.kind, status: "queued", jobId: "job" };
    });

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "auto-tagging")).toEqual({
      kind: "auto-tagging",
      status: "failed-to-queue",
      error: "redis is down",
    });
    expect(results.filter((r) => r.status === "queued")).toHaveLength(KIND_COUNT - 1);
  });

  it("skips everything when the recipe can no longer be loaded", async () => {
    getRecipeFull.mockResolvedValue(null);

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(results.every((r) => r.status === "skipped" && r.reason === "recipe-unavailable")).toBe(
      true
    );
    expect(addEnrichmentJob).not.toHaveBeenCalled();
  });
});

describe("image generation eligibility", () => {
  it("skips an ordinary automatic run for a recipe with a gallery image", async () => {
    getRecipeFull.mockResolvedValue(
      recipe({ images: [{ image: "/recipes/recipe-1/photo.jpg", order: 0 }] })
    );

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "image-generation")).toEqual({
      kind: "image-generation",
      status: "skipped",
      reason: "supplied-data-present",
    });
    expect(outcome(results, "auto-tagging")?.status).toBe("queued");
  });

  it("skips an ordinary automatic run for a recipe with only the legacy scalar", async () => {
    getRecipeFull.mockResolvedValue(recipe({ image: "/recipes/recipe-1/hero.jpg", images: [] }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "image-generation")).toEqual({
      kind: "image-generation",
      status: "skipped",
      reason: "supplied-data-present",
    });
  });

  it("treats a blank legacy scalar as no image at all", async () => {
    getRecipeFull.mockResolvedValue(recipe({ image: "   ", images: [] }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "image-generation")?.status).toBe("queued");
  });

  it("does not skip a manual request over a stored image", async () => {
    getRecipeFull.mockResolvedValue(
      recipe({ images: [{ image: "/recipes/recipe-1/photo.jpg", order: 0 }] })
    );

    const results = await enrichRecipe(context, { origin: "manual", kind: "image-generation" });

    expect(results[0]?.status).toBe("queued");
  });

  it("does not skip an administrator's refresh over a stored image", async () => {
    getRecipeFull.mockResolvedValue(
      recipe({ images: [{ image: "/recipes/recipe-1/photo.jpg", order: 0 }] })
    );

    const results = await enrichRecipe(context, { origin: "automatic", replaceExisting: true });

    expect(outcome(results, "image-generation")?.status).toBe("queued");
  });

  it.each([
    ["an automatic run", { origin: "automatic" }],
    ["a manual request", { origin: "manual", kind: "image-generation" }],
    ["an administrator's refresh", { origin: "automatic", replaceExisting: true }],
  ] as const)("skips %s when no image provider is configured", async (_origin, request) => {
    isImageGenerationConfigured.mockResolvedValue(false);

    const results = await enrichRecipe(context, request as never);

    expect(outcome(results, "image-generation")).toEqual({
      kind: "image-generation",
      status: "skipped",
      reason: "no-image-provider",
    });
  });

  it("leaves the other kinds untouched by an unconfigured image provider", async () => {
    isImageGenerationConfigured.mockResolvedValue(false);

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "auto-tagging")?.status).toBe("queued");
    expect(outcome(results, "recipe-provenance")?.status).toBe("queued");
  });
});

describe("automatic enrollment asked to replace", () => {
  it("suspends every Supplied Recipe Data skip, because redoing them is the point", async () => {
    getRecipeFull.mockResolvedValue(
      recipe({
        categories: ["Dinner"],
        calories: 240,
        fat: "9",
        carbs: "30",
        protein: "12",
        originCountry: "IT",
        provenanceNote: "Set by an editor.",
        cuisines: [{ id: "id-italian", name: "Italian" }],
      })
    );

    const results = await enrichRecipe(context, { origin: "automatic", replaceExisting: true });

    expect(results.every((result) => result.status === "queued")).toBe(true);
    expect(addEnrichmentJob).toHaveBeenCalledTimes(KIND_COUNT);
  });

  it("marks the jobs so the workers' writes replace rather than fill gaps", async () => {
    await enrichRecipe(context, { origin: "automatic", replaceExisting: true });

    expect(addEnrichmentJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ origin: "automatic", replaceExisting: true })
    );
  });

  it("leaves the flag off an ordinary automatic enrollment", async () => {
    await enrichRecipe(context, { origin: "automatic" });

    expect(addEnrichmentJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ replaceExisting: undefined })
    );
  });

  it("still honors the automatic switches", async () => {
    getAutomaticEnrichmentConfig.mockResolvedValue({ ...ALL_ON, autoTagging: false });

    const results = await enrichRecipe(context, { origin: "automatic", replaceExisting: true });

    expect(outcome(results, "auto-tagging")).toEqual({
      kind: "auto-tagging",
      status: "skipped",
      reason: "automatic-disabled",
    });
  });

  it("still skips a kind whose input the recipe lacks", async () => {
    getRecipeFull.mockResolvedValue(recipe({ steps: [] }));

    const results = await enrichRecipe(context, { origin: "automatic", replaceExisting: true });

    expect(outcome(results, "ingredient-linking")).toEqual({
      kind: "ingredient-linking",
      status: "skipped",
      reason: "insufficient-input",
    });
  });

  it("still refuses when AI is globally disabled", async () => {
    isAIEnabled.mockResolvedValue(false);

    const results = await enrichRecipe(context, { origin: "automatic", replaceExisting: true });

    expect(results.every((r) => r.status === "skipped" && r.reason === "ai-disabled")).toBe(true);
  });
});

describe("manual enrollment", () => {
  it("enrolls only the requested kind", async () => {
    const results = await enrichRecipe(context, { origin: "manual", kind: "auto-tagging" });

    expect(results).toEqual([
      { kind: "auto-tagging", status: "queued", jobId: "enrich_auto-tagging_recipe-1" },
    ]);
    expect(addEnrichmentJob).toHaveBeenCalledTimes(1);
  });

  it("records the requesting user so terminal failure can be targeted", async () => {
    await enrichRecipe(context, { origin: "manual", kind: "auto-tagging" });

    expect(addEnrichmentJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ origin: "manual", requestedByUserId: "user-1" })
    );
  });

  it.each([
    ["autoTagging", "auto-tagging"],
    ["allergyDetection", "allergy-detection"],
    ["autoCategorization", "auto-categorization"],
    ["nutritionEstimation", "nutrition-estimation"],
    ["recipeProvenance", "recipe-provenance"],
    ["ingredientLinking", "ingredient-linking"],
    ["imageGeneration", "image-generation"],
  ] as const)("ignores the %s automatic switch", async (setting, kind) => {
    getAutomaticEnrichmentConfig.mockResolvedValue({ ...ALL_ON, [setting]: false });

    const results = await enrichRecipe(context, { origin: "manual", kind });

    expect(results[0]?.status).toBe("queued");
  });

  it("still refuses when AI is globally disabled", async () => {
    isAIEnabled.mockResolvedValue(false);

    const results = await enrichRecipe(context, { origin: "manual", kind: "auto-tagging" });

    expect(results).toEqual([{ kind: "auto-tagging", status: "skipped", reason: "ai-disabled" }]);
  });

  it("replaces supplied categories on request", async () => {
    getRecipeFull.mockResolvedValue(recipe({ categories: ["Dinner"] }));

    const results = await enrichRecipe(context, { origin: "manual", kind: "auto-categorization" });

    expect(results[0]?.status).toBe("queued");
  });

  it("replaces the whole supplied provenance group on request", async () => {
    getRecipeFull.mockResolvedValue(
      recipe({ originCountry: "IT", provenanceNote: "Set by an editor." })
    );

    const results = await enrichRecipe(context, { origin: "manual", kind: "recipe-provenance" });

    expect(results[0]?.status).toBe("queued");
  });

  it("replaces supplied nutrition on request", async () => {
    getRecipeFull.mockResolvedValue(recipe({ calories: 240 }));

    const results = await enrichRecipe(context, {
      origin: "manual",
      kind: "nutrition-estimation",
    });

    expect(results[0]?.status).toBe("queued");
  });

  it("still observes the input contract", async () => {
    getRecipeFull.mockResolvedValue(recipe({ recipeIngredients: [] }));

    const results = await enrichRecipe(context, { origin: "manual", kind: "auto-tagging" });

    expect(results).toEqual([
      { kind: "auto-tagging", status: "skipped", reason: "insufficient-input" },
    ]);
  });

  it("reports a failed allergy lookup on a manual allergy request", async () => {
    getAllergiesForUsers.mockRejectedValue(new Error("allergy database is down"));

    const results = await enrichRecipe(context, { origin: "manual", kind: "allergy-detection" });

    expect(results).toEqual([
      {
        kind: "allergy-detection",
        status: "failed-to-queue",
        error: "allergy database is down",
      },
    ]);
  });

  it("still observes configured household allergies", async () => {
    getAllergiesForUsers.mockResolvedValue([]);

    const results = await enrichRecipe(context, { origin: "manual", kind: "allergy-detection" });

    expect(results).toEqual([
      { kind: "allergy-detection", status: "skipped", reason: "no-household-allergies" },
    ]);
  });

  it("returns failed-to-queue immediately when the producer throws", async () => {
    addEnrichmentJob.mockRejectedValue(new Error("redis is down"));

    const results = await enrichRecipe(context, { origin: "manual", kind: "auto-tagging" });

    expect(results).toEqual([
      { kind: "auto-tagging", status: "failed-to-queue", error: "redis is down" },
    ]);
  });
});
