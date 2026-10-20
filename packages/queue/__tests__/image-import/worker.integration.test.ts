// @vitest-environment node

import type { Job } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeInsertDTO } from "@norish/shared/contracts";

import type { ImageImportJobData } from "../../src/contracts/job-types";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

const mocked = vi.hoisted(() => ({
  extract: vi.fn(),
  settle: vi.fn(
    async (_queue: unknown, _outcome: { recipeId?: string; errorCode?: string }) => undefined
  ),
  saveImageBytes: vi.fn(
    async (_bytes: Buffer, recipeId: string) => `/recipes/${recipeId}/image.jpg`
  ),
  deleteRecipeImagesDir: vi.fn(),
  dishColor: vi.fn(async () => "#000000"),
  announce: vi.fn(async () => undefined),
  publish: vi.fn(async () => undefined),
}));

vi.mock("@norish/queue/api-handlers", () => ({
  requireQueueApiHandler: vi.fn(() => mocked.extract),
}));

vi.mock("../../src/image-import/batch", () => ({
  settleImageImportBatchItem: mocked.settle,
}));

vi.mock("@norish/queue/registry", () => ({
  getQueues: vi.fn(() => ({ imageImport: {} })),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
  getIngredientWords: vi.fn().mockResolvedValue({}),
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "everyone" }),
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: mocked.saveImageBytes,
  deleteRecipeImagesDir: mocked.deleteRecipeImagesDir,
}));

vi.mock("@norish/shared-server/media/dish-color", () => ({
  dishColorForImageUrl: mocked.dishColor,
}));

vi.mock("@norish/queue/enrichment/announce", () => ({
  announceUsableRecipe: mocked.announce,
}));

vi.mock("@norish/shared-server/realtime/recipes", () => ({
  recipes: { publish: mocked.publish },
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const describeDb = process.env.CI ? describe : describe.skip;

function extracted(name: string, url: string | null = null): FullRecipeInsertDTO {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    name,
    description: null,
    notes: null,
    url,
    image: null,
    servings: 2,
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
  };
}

describeDb("image import worker integration", () => {
  const testBase = new RepositoryTestBase("test_image_import_worker");
  let userId: string;
  let processImageImportJob: typeof import("../../src/image-import/worker").processImageImportJob;
  let getRecipeFull: typeof import("@norish/db").getRecipeFull;

  beforeAll(async () => {
    await testBase.setup();

    const { resetDbConnection } = await import("@norish/db/drizzle");

    await resetDbConnection();

    ({ processImageImportJob } = await import("../../src/image-import/worker"));
    ({ getRecipeFull } = await import("@norish/db"));
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    mocked.extract.mockReset();
    mocked.settle.mockClear();
    mocked.saveImageBytes.mockClear();
    mocked.publish.mockClear();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("creates one recipe and one image for each of three batch items", async () => {
    const ids = [
      "123e4567-e89b-42d3-a456-426614174001",
      "123e4567-e89b-42d3-a456-426614174002",
      "123e4567-e89b-42d3-a456-426614174003",
    ];

    mocked.extract.mockImplementation(async () =>
      extracted("Image recipe", "https://same.example/recipe")
    );

    for (const [index, recipeId] of ids.entries()) {
      await processImageImportJob({
        id: `job-${index}`,
        attemptsMade: 0,
        opts: {},
        data: {
          recipeId,
          userId,
          householdKey: "household-test",
          householdUserIds: [userId],
          batchId: "batch-integration-1",
          batchItemId: `item-${index}`,
          files: [
            {
              data: Buffer.from(`image-${index}`).toString("base64"),
              mimeType: "image/png",
              filename: `image-${index}.png`,
            },
          ],
        },
      } as Job<ImageImportJobData>);
    }

    const recipes = await Promise.all(ids.map((id) => getRecipeFull(id)));

    expect(recipes.filter((recipe) => recipe !== null)).toHaveLength(3);
    expect(new Set(recipes.map((recipe) => recipe!.id)).size).toBe(3);
    expect(recipes.every((recipe) => recipe!.url === null)).toBe(true);
    expect(recipes.reduce((count, recipe) => count + recipe!.images.length, 0)).toBe(3);
    expect(mocked.settle).toHaveBeenCalledTimes(3);

    const settledIds = mocked.settle.mock.calls.map((call) => call[1].recipeId);

    expect(new Set(settledIds).size).toBe(3);
    expect(new Set(settledIds)).toEqual(new Set(ids));
  });

  it("keeps two image recipes with no source URL", async () => {
    const ids = ["123e4567-e89b-42d3-a456-426614174004", "123e4567-e89b-42d3-a456-426614174005"];
    const { createResolvedRecipe } = await import("@norish/shared-server/ingredients/recipe-lines");

    const first = await createResolvedRecipe(ids[0]!, userId, extracted("First"), { userId });
    const second = await createResolvedRecipe(ids[1]!, userId, extracted("Second"), { userId });

    expect(first).toMatchObject({ status: "inserted" });
    expect(second).toMatchObject({ status: "inserted" });

    const recipes = await Promise.all(ids.map((id) => getRecipeFull(id)));

    expect(recipes.filter((recipe) => recipe !== null)).toHaveLength(2);
  });
});
