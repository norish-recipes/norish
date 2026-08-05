import { beforeEach, describe, expect, it, vi } from "vitest";

const getRecipeFull = vi.fn();
const getHouseholdMemberIds = vi.fn();
const getAllergiesForUsers = vi.fn();
const getAllRecipesForEnrichment = vi.fn();
const isAIEnabled = vi.fn();
const getAutomaticEnrichmentConfig = vi.fn();
const addEnrichmentJob = vi.fn();

vi.mock("@norish/db", () => ({
  getRecipeFull,
  getHouseholdMemberIds,
  getAllergiesForUsers,
}));

vi.mock("@norish/db/repositories/recipes", () => ({
  getAllRecipesForEnrichment,
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

const { enrollEnrichmentForAllRecipes } = await import("../../src/enrichment/bulk");

const requester = { userId: "admin-1", householdKey: "admin-household" };

const ALL_ON = {
  autoTagging: true,
  allergyDetection: true,
  autoCategorization: true,
  nutritionEstimation: true,
  recipeProvenance: true,
  ingredientLinking: true,
};

const KIND_COUNT = 6;

function recipe(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Recipe ${id}`,
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

beforeEach(() => {
  vi.clearAllMocks();
  getRecipeFull.mockImplementation(async (id: string) => recipe(id));
  getHouseholdMemberIds.mockResolvedValue(["user-1"]);
  getAllergiesForUsers.mockResolvedValue(["Milk"]);
  isAIEnabled.mockResolvedValue(true);
  getAutomaticEnrichmentConfig.mockResolvedValue(ALL_ON);
  getAllRecipesForEnrichment.mockResolvedValue([
    { recipeId: "recipe-1", userId: "user-1", householdId: "household-1" },
    { recipeId: "recipe-2", userId: "user-2", householdId: "household-2" },
  ]);
  addEnrichmentJob.mockImplementation(async (_queue, data) => ({
    kind: data.kind,
    status: "queued",
    jobId: `enrich_${data.kind}_${data.recipeId}`,
  }));
});

describe("enrollEnrichmentForAllRecipes", () => {
  it("enrolls every recipe with the automatic origin and each recipe's own context", async () => {
    const result = await enrollEnrichmentForAllRecipes(requester);

    expect(result).toEqual({ recipes: 2, queued: 2 * KIND_COUNT });
    expect(addEnrichmentJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipeId: "recipe-2",
        userId: "user-2",
        householdKey: "household-2",
        origin: "automatic",
        requestedByUserId: undefined,
      })
    );
  });

  it("respects the automatic switches: only enabled kinds are queued", async () => {
    getAutomaticEnrichmentConfig.mockResolvedValue({
      ...ALL_ON,
      autoTagging: false,
      allergyDetection: false,
      nutritionEstimation: false,
      recipeProvenance: false,
      ingredientLinking: false,
    });

    const result = await enrollEnrichmentForAllRecipes(requester);

    expect(result.queued).toBe(2);
    expect(
      addEnrichmentJob.mock.calls.every(([, data]) => data.kind === "auto-categorization")
    ).toBe(true);
  });

  it("keeps letting Supplied Recipe Data win", async () => {
    getRecipeFull.mockImplementation(async (id: string) =>
      id === "recipe-1"
        ? recipe(id, { calories: 240, fat: "9", carbs: "30", protein: "12" })
        : recipe(id)
    );

    const result = await enrollEnrichmentForAllRecipes(requester);

    // recipe-1's complete nutrition group suppresses that kind; everything else runs.
    expect(result.queued).toBe(2 * KIND_COUNT - 1);
    expect(
      addEnrichmentJob.mock.calls.some(
        ([, data]) => data.recipeId === "recipe-1" && data.kind === "nutrition-estimation"
      )
    ).toBe(false);
  });

  it("falls back to the requester's context for a recipe whose owner is gone", async () => {
    getAllRecipesForEnrichment.mockResolvedValue([
      { recipeId: "recipe-orphan", userId: null, householdId: null },
    ]);

    await enrollEnrichmentForAllRecipes(requester);

    expect(addEnrichmentJob).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipeId: "recipe-orphan",
        userId: "admin-1",
        householdKey: "admin-household",
      })
    );
  });

  it("counts only genuinely queued runs, not duplicates or skips", async () => {
    addEnrichmentJob.mockImplementation(async (_queue, data) =>
      data.kind === "auto-tagging"
        ? { kind: data.kind, status: "duplicate", existingJobId: "existing" }
        : { kind: data.kind, status: "queued", jobId: `enrich_${data.kind}_${data.recipeId}` }
    );

    const result = await enrollEnrichmentForAllRecipes(requester);

    expect(result.queued).toBe(2 * (KIND_COUNT - 1));
  });

  it("reports zero queued when AI is disabled, without loading recipes", async () => {
    isAIEnabled.mockResolvedValue(false);

    const result = await enrollEnrichmentForAllRecipes(requester);

    expect(result).toEqual({ recipes: 2, queued: 0 });
    expect(getRecipeFull).not.toHaveBeenCalled();
    expect(addEnrichmentJob).not.toHaveBeenCalled();
  });
});
