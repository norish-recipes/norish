import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";

const getRecipeFull = vi.fn();
const getHouseholdMemberIds = vi.fn();
const getAllergiesForUsers = vi.fn();
const isAIEnabled = vi.fn();
const getAutomaticEnrichmentConfig = vi.fn();
const addEnrichmentJob = vi.fn();

vi.mock("@norish/db", () => ({
  getRecipeFull,
  getHouseholdMemberIds,
  getAllergiesForUsers,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isAIEnabled,
  getAutomaticEnrichmentConfig,
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
};

const KIND_COUNT = 6;

function recipe(overrides: Record<string, unknown> = {}) {
  return {
    id: "recipe-1",
    name: "Test",
    recipeIngredients: [{ ingredientName: "flour" }],
    steps: [{ step: "Mix the flour in.", systemUsed: "metric", order: 0 }],
    categories: [],
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
  addEnrichmentJob.mockImplementation(async (_queue, data) => ({
    kind: data.kind,
    status: "queued",
    jobId: `enrich_${data.kind}_${data.recipeId}`,
  }));
});

describe("automatic enrollment", () => {
  it("enrolls every eligible kind independently", async () => {
    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(results).toHaveLength(KIND_COUNT);
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
    ["allergyDetection", "allergy-detection"],
    ["autoCategorization", "auto-categorization"],
    ["nutritionEstimation", "nutrition-estimation"],
    ["recipeProvenance", "recipe-provenance"],
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

  it("skips allergy detection when the household has no configured allergies", async () => {
    getAllergiesForUsers.mockResolvedValue([]);

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "allergy-detection")).toEqual({
      kind: "allergy-detection",
      status: "skipped",
      reason: "no-household-allergies",
    });
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

  it.each(["calories", "fat", "carbs", "protein"] as const)(
    "skips nutrition estimation when supplied %s makes the group substantive",
    async (field) => {
      getRecipeFull.mockResolvedValue(recipe({ [field]: field === "calories" ? 240 : "12" }));

      const results = await enrichRecipe(context, { origin: "automatic" });

      expect(outcome(results, "nutrition-estimation")).toEqual({
        kind: "nutrition-estimation",
        status: "skipped",
        reason: "supplied-data-present",
      });
    }
  );

  it("treats blank nutrition values as absent", async () => {
    getRecipeFull.mockResolvedValue(recipe({ fat: "  ", carbs: "" }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "nutrition-estimation")?.status).toBe("queued");
  });

  it.each([
    ["originCountry", "IT"],
    ["originRegion", "Lazio"],
    ["provenanceNote", "A Roman classic."],
  ] as const)(
    "skips provenance when supplied %s makes the whole group substantive",
    async (field, value) => {
      getRecipeFull.mockResolvedValue(recipe({ [field]: value }));

      const results = await enrichRecipe(context, { origin: "automatic" });

      expect(outcome(results, "recipe-provenance")).toEqual({
        kind: "recipe-provenance",
        status: "skipped",
        reason: "supplied-data-present",
      });
    }
  );

  it("skips provenance when a supplied Cuisine makes the whole group substantive", async () => {
    getRecipeFull.mockResolvedValue(recipe({ cuisines: [{ id: "id-italian", name: "Italian" }] }));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "recipe-provenance")).toEqual({
      kind: "recipe-provenance",
      status: "skipped",
      reason: "supplied-data-present",
    });
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
    expect(outcome(results, "allergy-detection")?.status).toBe("queued");
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

  it("keeps enrolling siblings when allergy lookup throws", async () => {
    getAllergiesForUsers.mockRejectedValue(new Error("allergy database is down"));

    const results = await enrichRecipe(context, { origin: "automatic" });

    expect(outcome(results, "allergy-detection")).toEqual({
      kind: "allergy-detection",
      status: "failed-to-queue",
      error: "allergy database is down",
    });
    expect(outcome(results, "auto-tagging")?.status).toBe("queued");
    expect(outcome(results, "auto-categorization")?.status).toBe("queued");
    expect(outcome(results, "nutrition-estimation")?.status).toBe("queued");
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
