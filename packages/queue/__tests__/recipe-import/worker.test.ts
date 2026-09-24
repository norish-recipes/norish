// @vitest-environment node
/**
 * The URL-import store path for the Dish Colour (ADR-0023): the recipe the
 * parser produced is created with the colour extracted from the image the
 * import just stored. The extraction itself is pinned in
 * shared-server/__tests__/media/dish-color.test.ts; here the sentinel proves
 * the worker threads it into the write.
 */
import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeImportJobData } from "@norish/queue/contracts/job-types";
import { readStepProgress } from "@norish/queue/job-steps";
import { ErrorWithDetail } from "@norish/shared/lib/error-extensions";

const createRecipeWithRefs = vi.fn();
const dashboardRecipe = vi.fn();
const recipeExistsByUrlForPolicy = vi.fn();
const getDecryptedTokensByUserId = vi.fn();
const publishRecipe = vi.fn(async () => undefined);
const parseRecipeFromUrl = vi.fn();
const withDishColor = vi.fn();

vi.mock("@norish/db", () => ({
  createRecipeWithRefs,
  dashboardRecipe,
  recipeExistsByUrlForPolicy,
}));

vi.mock("@norish/db/repositories/site-auth-tokens", () => ({
  getDecryptedTokensByUserId,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "everyone" }),
}));

vi.mock("@norish/queue/api-handlers", () => ({
  requireQueueApiHandler: vi.fn(() => parseRecipeFromUrl),
}));

vi.mock("@norish/shared-server/realtime/recipes", () => ({
  recipes: { publish: publishRecipe },
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@norish/shared-server/media/dish-color", () => ({
  withDishColor,
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  deleteRecipeImagesDir: vi.fn(),
}));

const PARSED_RECIPE = {
  id: "recipe-77",
  name: "Imported Stew",
  image: "/recipes/recipe-77/photo.jpg",
  recipeIngredients: [],
  steps: [],
  tags: [],
  categories: [],
  images: [],
  videos: [],
};

describe("processImportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    recipeExistsByUrlForPolicy.mockResolvedValue({ exists: false });
    getDecryptedTokensByUserId.mockResolvedValue([]);
    parseRecipeFromUrl.mockResolvedValue({ recipe: PARSED_RECIPE, usedAI: false });
    withDishColor.mockImplementation(async (dto) => ({ ...dto, dishColor: "#7c4a1e" }));
    createRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId: "recipe-77" });
    dashboardRecipe.mockResolvedValue({ id: "recipe-77", name: "Imported Stew" });
  });

  it("creates the imported recipe with the extracted Dish Colour (URL-import path)", async () => {
    const { processRecipeImportJob } = await import("../../src/recipe-import/worker");

    await processRecipeImportJob({
      id: "job-1",
      attemptsMade: 0,
      opts: {},
      data: {
        url: "https://example.com/stew",
        recipeId: "recipe-77",
        userId: "user-1",
        householdKey: "household-1",
        householdUserIds: null,
      },
    } as unknown as Job<RecipeImportJobData>);

    expect(withDishColor).toHaveBeenCalledWith(PARSED_RECIPE);
    expect(createRecipeWithRefs).toHaveBeenCalledWith(
      "recipe-77",
      "user-1",
      expect.objectContaining({ name: "Imported Stew", dishColor: "#7c4a1e" })
    );
  });

  it("leaves what the parser saw on the parsing step when the parse fails", async () => {
    const pythonParser = { recipe: { title: "" }, parser: { scraper: "SchemaScraper" } };

    parseRecipeFromUrl.mockRejectedValue(
      new ErrorWithDetail("Python parser returned recipe data without a valid title", {
        pythonParser,
      })
    );

    const { processRecipeImportJob } = await import("../../src/recipe-import/worker");
    const job = {
      id: "job-1",
      attemptsMade: 0,
      opts: {},
      progress: 0,
      updateProgress: vi.fn(async (progress: unknown) => {
        job.progress = progress;
      }),
      log: vi.fn(async () => 0),
      data: {
        url: "https://example.com/untitled",
        recipeId: "recipe-77",
        userId: "user-1",
        householdKey: "household-1",
        householdUserIds: null,
      },
    };

    await expect(
      processRecipeImportJob(job as unknown as Job<RecipeImportJobData>)
    ).rejects.toThrow("without a valid title");

    const timeline = readStepProgress(job.progress)?.attempts[0]?.timeline ?? [];

    expect(timeline.at(-1)).toMatchObject({ id: "parsing", detail: { pythonParser } });
  });

  it("leaves the parser diagnostics on the parsing step when AI extraction stood in", async () => {
    const pythonParser = { ok: true, recipe: { title: null } };
    const page = { title: "Stew", text: "Stew" };

    parseRecipeFromUrl.mockResolvedValue({
      recipe: PARSED_RECIPE,
      usedAI: true,
      parserDiagnostics: { pythonParser, page },
    });

    const { processRecipeImportJob } = await import("../../src/recipe-import/worker");
    const job = {
      id: "job-1",
      attemptsMade: 0,
      opts: {},
      progress: 0,
      updateProgress: vi.fn(async (progress: unknown) => {
        job.progress = progress;
      }),
      log: vi.fn(async () => 0),
      data: {
        url: "https://example.com/untitled",
        recipeId: "recipe-77",
        userId: "user-1",
        householdKey: "household-1",
        householdUserIds: null,
      },
    };

    await processRecipeImportJob(job as unknown as Job<RecipeImportJobData>);

    const timeline = readStepProgress(job.progress)?.attempts[0]?.timeline ?? [];

    expect(timeline.find((event) => event.id === "parsing")?.detail).toEqual({
      usedAI: true,
      pythonParser,
      page,
    });
  });

  describe("site authentication tokens", () => {
    const token = (overrides: Record<string, unknown>) => ({
      id: "token",
      userId: "user-1",
      domain: "example.com",
      account: null,
      name: "sessionid",
      value: "secret",
      type: "cookie",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    const runImport = async (url: string) => {
      const { processRecipeImportJob } = await import("../../src/recipe-import/worker");

      await processRecipeImportJob({
        id: "job-1",
        attemptsMade: 0,
        opts: {},
        data: {
          url,
          recipeId: "recipe-77",
          userId: "user-1",
          householdKey: "household-1",
          householdUserIds: null,
        },
      } as unknown as Job<RecipeImportJobData>);
    };

    const tokensPassedToParser = () =>
      (parseRecipeFromUrl.mock.calls.at(-1)?.[3] ?? []) as { id: string }[];

    it("sends no tokens for a site the user has none for", async () => {
      getDecryptedTokensByUserId.mockResolvedValue([token({ id: "ig", domain: "instagram.com" })]);

      await runImport("https://example.com/stew");

      expect(parseRecipeFromUrl.mock.calls.at(-1)?.[3]).toBeUndefined();
    });

    it("keeps one site's tokens off another site's import", async () => {
      getDecryptedTokensByUserId.mockResolvedValue([
        token({ id: "ig", domain: "instagram.com" }),
        token({ id: "ex", domain: "example.com" }),
      ]);

      await runImport("https://example.com/stew");

      expect(tokensPassedToParser().map((t) => t.id)).toEqual(["ex"]);
    });

    it("uses one account per import, never two at once", async () => {
      getDecryptedTokensByUserId.mockResolvedValue([
        token({ id: "alice", domain: "instagram.com", account: "alice" }),
        token({ id: "bob", domain: "instagram.com", account: "bob" }),
      ]);

      const used = new Set<string>();

      for (let i = 0; i < 50; i++) {
        await runImport("https://www.instagram.com/p/123");

        const ids = tokensPassedToParser().map((t) => t.id);

        expect(ids).toHaveLength(1);
        used.add(ids[0] as string);
      }

      expect([...used].sort()).toEqual(["alice", "bob"]);
    });
  });
});
