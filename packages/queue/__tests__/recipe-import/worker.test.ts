// @vitest-environment node
/**
 * The URL-import store path for the Dish Colour (ADR-0023): the recipe the
 * parser produced is created with the colour extracted from the image the
 * import just stored. The extraction itself is pinned in
 * shared-server/__tests__/media/dish-color.test.ts; here the sentinel proves
 * the worker threads it into the write.
 */
import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeImportJobData } from "@norish/queue/contracts/job-types";
import { readStepProgress } from "@norish/queue/job-steps";
import {
  AIConfigurationError,
  AIProviderError,
  AIResponseError,
} from "@norish/shared-server/ai/runtime/errors";
import {
  NOT_A_RECIPE_REASON,
  PRIVATE_ADDRESS_REASON,
} from "@norish/shared/contracts/realtime/recipes";
import { ErrorWithDetail } from "@norish/shared/lib/error-extensions";

const createRecipeWithRefs = vi.fn();
const dashboardRecipe = vi.fn();
const recipeExistsByUrlForPolicy = vi.fn();
const getDecryptedTokensByUserId = vi.fn();
const publishRecipe = vi.fn(async () => undefined);
const parseRecipeFromUrl = vi.fn();
const withDishColor = vi.fn();
/** Which errors read as a rate limit; the reading itself is pinned in errors.test.ts. */
const rateLimitWaitMs = vi.hoisted(() => vi.fn((_error: unknown): number | null => null));

vi.mock("@norish/shared-server/ai/runtime/errors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/ai/runtime/errors")>()),
  rateLimitWaitMs,
}));

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

  it("ends on the existing recipe when the URL is already in the library", async () => {
    const { processRecipeImportJob } = await import("../../src/recipe-import/worker");

    recipeExistsByUrlForPolicy.mockResolvedValue({ exists: true, existingRecipeId: "recipe-12" });

    await expect(
      processRecipeImportJob({
        id: "job-2",
        attemptsMade: 0,
        opts: {},
        data: {
          url: "https://example.com/stew",
          recipeId: "recipe-78",
          userId: "user-1",
          householdKey: "household-1",
          householdUserIds: null,
        },
      } as unknown as Job<RecipeImportJobData>)
    ).resolves.toBe("recipe-12");
    expect(createRecipeWithRefs).not.toHaveBeenCalled();
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

  describe("an AI failure (#645)", () => {
    const job = () =>
      ({
        id: "job-1",
        attemptsMade: 0,
        opts: { attempts: 3 },
        progress: 0,
        updateProgress: vi.fn(async () => undefined),
        log: vi.fn(async () => 0),
        data: {
          url: "https://www.instagram.com/reel/ABC123/",
          recipeId: "recipe-77",
          userId: "user-1",
          householdKey: "household-1",
          householdUserIds: null,
        },
      }) as unknown as Job<RecipeImportJobData>;

    /** How the video path hands an AI failure up: wrapped, with the original as cause. */
    const wrapped = (cause: Error) =>
      new Error(`Failed to process video recipe: ${cause.message}`, { cause });

    it("stops retrying a rate limit the SDK already retried", async () => {
      const rateLimited = new AIProviderError("The AI provider rate-limited the request.", {
        retryable: true,
      });

      rateLimitWaitMs.mockImplementation((error) => (error === rateLimited ? 15_000 : null));
      const original = wrapped(rateLimited);

      parseRecipeFromUrl.mockRejectedValue(original);

      const { processRecipeImportJob } = await import("../../src/recipe-import/worker");
      const failure = await processRecipeImportJob(job()).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(UnrecoverableError);
      expect((failure as Error).message).toBe(
        "Failed to process video recipe: The AI provider rate-limited the request."
      );
      expect((failure as Error).cause).toBe(original);
    });

    it("stops retrying an AI error no retry can fix", async () => {
      parseRecipeFromUrl.mockRejectedValue(wrapped(new AIConfigurationError("No API key.")));

      const { processRecipeImportJob } = await import("../../src/recipe-import/worker");

      await expect(processRecipeImportJob(job())).rejects.toBeInstanceOf(UnrecoverableError);
    });

    it("leaves a retryable AI error to the queue's attempts", async () => {
      const unusable = wrapped(new AIResponseError("missing required fields"));

      parseRecipeFromUrl.mockRejectedValue(unusable);

      const { processRecipeImportJob } = await import("../../src/recipe-import/worker");

      await expect(processRecipeImportJob(job())).rejects.toBe(unusable);
    });
  });

  it("stops retrying a page the Decision Model clearly says is not a recipe", async () => {
    const pythonParser = { recipe: { title: "" } };
    const verdict = new ErrorWithDetail(NOT_A_RECIPE_REASON, { pythonParser });

    parseRecipeFromUrl.mockRejectedValue(verdict);

    const { processRecipeImportJob } = await import("../../src/recipe-import/worker");
    const job = {
      id: "job-1",
      attemptsMade: 0,
      opts: { attempts: 3 },
      progress: 0,
      updateProgress: vi.fn(async (progress: unknown) => {
        job.progress = progress;
      }),
      log: vi.fn(async () => 0),
      data: {
        url: "https://example.com/about",
        recipeId: "recipe-77",
        userId: "user-1",
        householdKey: "household-1",
        householdUserIds: null,
      },
    };
    const failure = await processRecipeImportJob(job as unknown as Job<RecipeImportJobData>).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(UnrecoverableError);
    expect((failure as Error).message).toBe(NOT_A_RECIPE_REASON);
    expect((failure as Error).cause).toBe(verdict);
    expect(readStepProgress(job.progress)?.attempts[0]?.timeline.at(-1)).toMatchObject({
      id: "parsing",
      detail: { pythonParser },
    });
  });

  it("stops retrying a private address the server refuses", async () => {
    parseRecipeFromUrl.mockRejectedValue(new Error(PRIVATE_ADDRESS_REASON));

    const { processRecipeImportJob } = await import("../../src/recipe-import/worker");
    const job = {
      id: "job-1",
      attemptsMade: 0,
      opts: { attempts: 3 },
      progress: 0,
      updateProgress: vi.fn(async (progress: unknown) => {
        job.progress = progress;
      }),
      log: vi.fn(async () => 0),
      data: {
        url: "http://192.168.1.1/",
        recipeId: "recipe-78",
        userId: "user-1",
        householdKey: "household-1",
        householdUserIds: null,
      },
    };
    const failure = await processRecipeImportJob(job as unknown as Job<RecipeImportJobData>).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(UnrecoverableError);
    expect((failure as Error).message).toBe(PRIVATE_ADDRESS_REASON);
  });

  it("carries a possibly incomplete parse to the job monitor and the importer's toast", async () => {
    parseRecipeFromUrl.mockResolvedValue({
      recipe: PARSED_RECIPE,
      usedAI: false,
      incomplete: true,
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
        url: "https://example.com/thin",
        recipeId: "recipe-77",
        userId: "user-1",
        householdKey: "household-1",
        householdUserIds: null,
      },
    };

    await processRecipeImportJob(job as unknown as Job<RecipeImportJobData>);

    const timeline = readStepProgress(job.progress)?.attempts[0]?.timeline ?? [];

    expect(timeline.find((event) => event.id === "parsing")?.detail).toEqual({
      usedAI: false,
      incomplete: true,
    });
    expect(publishRecipe).toHaveBeenCalledWith(
      "imported",
      expect.objectContaining({ pendingRecipeId: "recipe-77", incomplete: true }),
      expect.anything()
    );
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
