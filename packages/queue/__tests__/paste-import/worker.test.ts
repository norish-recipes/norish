// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

const createRecipeWithRefs = vi.fn();
const dashboardRecipe = vi.fn();
const getHouseholdAllergyNames = vi.fn();
const rateRecipe = vi.fn();
const getAverageRating = vi.fn();
const publishRecipeBecameUsable = vi.fn(async () => undefined);
const publishRecipe = vi.fn(async () => undefined);

vi.mock("@norish/db", () => ({
  createRecipeWithRefs,
  dashboardRecipe,
  getHouseholdAllergyNames,
}));

vi.mock("@norish/db/repositories/ratings", () => ({
  rateRecipe,
  getAverageRating,
}));

// The audience reads each row's household and the account's at publish time.
vi.mock("@norish/db/repositories/households", () => ({
  getHouseholdIdForUser: vi.fn().mockResolvedValue("household-1"),
}));
const storedIds = vi.hoisted(() => ({ except: new Set<string>() }));

vi.mock("@norish/db/repositories/recipes", () => ({
  getRecipeHouseholdIds: vi.fn(
    async (ids: string[]) =>
      new Map(ids.filter((id) => !storedIds.except.has(id)).map((id) => [id, "household-1"]))
  ),
}));
vi.mock("@norish/db/repositories/cookbooks", () => ({ getCookbookRow: vi.fn() }));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    automaticEnrichment: {
      autoTagging: false,
      allergyDetection: false,
      autoCategorization: false,
      nutritionEstimation: false,
    },
  }),
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "everyone" }),
  isAIEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("@norish/queue/registry", () => ({
  getQueues: vi.fn(() => ({ autoTagging: {}, allergyDetection: {} })),
}));

vi.mock("@norish/shared-server/realtime/recipe-enrichment", () => ({
  recipeEnrichment: { publish: publishRecipeBecameUsable },
}));

vi.mock("@norish/shared-server/realtime/recipes", () => ({
  recipes: { publish: publishRecipe },
}));

// Resolution reads the catalogue; these tests are about the worker, not it.
vi.mock("@norish/shared-server/ingredients/recipe-lines", () => ({
  withResolvedIngredients: vi.fn(async (payload: object) => ({
    ...payload,
    ingredientResolutions: new Map(),
  })),
  createResolvedRecipe: vi.fn(async (id: string, userId: unknown, payload: object) =>
    createRecipeWithRefs(id, userId, { ...payload, ingredientResolutions: new Map() })
  ),
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

const deleteRecipeImagesDir = vi.hoisted(() => vi.fn());
const worker = vi.hoisted(() => ({
  onFailed: undefined as ((job: unknown, error: Error) => Promise<void>) | undefined,
}));

vi.mock("@norish/shared-server/media/storage", () => ({ deleteRecipeImagesDir }));

vi.mock("../../src/create-worker", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/create-worker")>()),
  createWorker: vi.fn((_name: string, _process: unknown, options: typeof worker) => {
    worker.onFailed = options.onFailed;
  }),
}));

describe("a failed paste import", () => {
  const failedJob = (attemptsMade: number) => ({
    id: "job-1",
    attemptsMade,
    opts: { attempts: 3 },
    data: { recipeIds: ["stored", "not-stored"], userId: "user-1" },
  });

  it("keeps every file while it will be retried, then removes only what no recipe holds", async () => {
    const { startPasteImportWorker } = await import("../../src/paste-import/worker");

    startPasteImportWorker();
    storedIds.except = new Set(["not-stored"]);

    await worker.onFailed!(failedJob(1), new Error("boom"));
    expect(deleteRecipeImagesDir).not.toHaveBeenCalled();

    await worker.onFailed!(failedJob(3), new Error("boom"));
    expect(deleteRecipeImagesDir.mock.calls).toEqual([["not-stored"]]);
    storedIds.except = new Set();
  });
});

describe("processPasteImportJob", () => {
  it("creates valid structured recipes in order and persists normalized ratings", async () => {
    const { processPasteImportJob } = await import("../../src/paste-import/worker");

    createRecipeWithRefs
      .mockResolvedValueOnce({ status: "inserted", recipeId: "recipe-1" })
      .mockResolvedValueOnce({ status: "inserted", recipeId: "recipe-2" });
    dashboardRecipe
      .mockResolvedValueOnce({ id: "recipe-1", name: "First" })
      .mockResolvedValueOnce({ id: "recipe-2", name: "Second" });
    getAverageRating.mockResolvedValue({ averageRating: 5, ratingCount: 1 });

    const result = await processPasteImportJob({
      id: "job-1",
      attemptsMade: 0,
      opts: {},
      data: {
        batchId: "batch-1",
        recipeIds: ["recipe-1", "recipe-invalid", "recipe-2"],
        userId: "user-1",
        householdId: "household-1",
        text: "structured",
        structuredRecipes: [
          {
            recipeId: "recipe-1",
            importedRating: 4.6,
            recipe: {
              name: "First",
              description: null,
              notes: null,
              url: null,
              image: null,
              servings: 1,
              prepMinutes: null,
              cookMinutes: null,
              totalMinutes: null,
              calories: null,
              fat: null,
              carbs: null,
              protein: null,
              systemUsed: "metric",
              recipeIngredients: [
                {
                  ingredientId: null,
                  ingredientName: "Egg",
                  amount: 1,
                  unit: null,
                  systemUsed: "metric",
                  order: 0,
                },
              ],
              steps: [{ step: "Mix", order: 1, systemUsed: "metric" }],
              tags: [],
              categories: [],
              images: [],
              videos: [],
            },
          },
          {
            recipeId: "recipe-invalid",
            importedRating: null,
            recipe: {
              name: "Invalid",
              description: null,
              notes: null,
              url: null,
              image: null,
              servings: 1,
              prepMinutes: null,
              cookMinutes: null,
              totalMinutes: null,
              calories: null,
              fat: null,
              carbs: null,
              protein: null,
              systemUsed: "metric",
              recipeIngredients: [],
              steps: [],
              tags: [],
              categories: [],
              images: [],
              videos: [],
            },
          },
          {
            recipeId: "recipe-2",
            importedRating: 9.2,
            recipe: {
              name: "Second",
              description: null,
              notes: null,
              url: null,
              image: null,
              servings: 1,
              prepMinutes: null,
              cookMinutes: null,
              totalMinutes: null,
              calories: null,
              fat: null,
              carbs: null,
              protein: null,
              systemUsed: "metric",
              recipeIngredients: [
                {
                  ingredientId: null,
                  ingredientName: "Milk",
                  amount: 1,
                  unit: null,
                  systemUsed: "metric",
                  order: 0,
                },
              ],
              steps: [{ step: "Cook", order: 1, systemUsed: "metric" }],
              tags: [],
              categories: [],
              images: [],
              videos: [],
            },
          },
        ],
      },
    } as any);

    expect(result).toEqual({ recipeIds: ["recipe-1", "recipe-2"] });
    expect(createRecipeWithRefs).toHaveBeenCalledTimes(2);
    expect(rateRecipe).toHaveBeenNthCalledWith(1, "user-1", "recipe-1", 5);
    expect(rateRecipe).toHaveBeenNthCalledWith(2, "user-1", "recipe-2", 5);
    // Creation and enrichment are separate: the worker persists and announces,
    // and the coordinator decides independently what should run.
    expect(publishRecipeBecameUsable).toHaveBeenCalledTimes(2);
    expect(publishRecipeBecameUsable).toHaveBeenNthCalledWith(
      1,
      "recipeBecameUsable",
      expect.objectContaining({ recipeId: "recipe-1", userId: "user-1" }),
      undefined
    );
  });

  it("fails when no valid structured items remain", async () => {
    const { processPasteImportJob } = await import("../../src/paste-import/worker");

    await expect(
      processPasteImportJob({
        id: "job-2",
        attemptsMade: 0,
        opts: {},
        data: {
          batchId: "batch-2",
          recipeIds: ["recipe-invalid"],
          userId: "user-1",
          householdId: "household-1",
          text: "structured",
          structuredRecipes: [
            {
              recipeId: "recipe-invalid",
              importedRating: null,
              recipe: {
                name: "Invalid",
                description: null,
                notes: null,
                url: null,
                image: null,
                servings: 1,
                prepMinutes: null,
                cookMinutes: null,
                totalMinutes: null,
                calories: null,
                fat: null,
                carbs: null,
                protein: null,
                systemUsed: "metric",
                recipeIngredients: [],
                steps: [],
                tags: [],
                categories: [],
                images: [],
                videos: [],
              },
            },
          ],
        },
      } as any)
    ).rejects.toThrow("No valid recipes found in structured paste input.");
  });
});
