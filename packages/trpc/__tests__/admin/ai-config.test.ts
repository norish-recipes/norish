// @vitest-environment node
/**
 * The bulk sweep's pre-flight image count, and the sweep itself.
 *
 * Image Generation is the one kind whose cost is per recipe and lands on a
 * bill, so before an administrator confirms Enrich All Recipes the modal
 * names the number of images it would generate — gaps only by default, every
 * eligible recipe with overwrite on. A server with the kind switched off
 * sees the modal exactly as it does today, which is what `enabled: false`
 * carries.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aiConfigProcedures } from "@norish/trpc/routers/admin/ai-config";

import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext, createMockAdminUser, createMockUser } from "./test-utils";

const mocks = vi.hoisted(() => ({
  getAutomaticEnrichmentConfig: vi.fn(),
  isImageGenerationConfigured: vi.fn(),
  isAIEnabled: vi.fn(),
  getRecipePermissionPolicy: vi.fn(),
  getImageGenerationSweepCounts: vi.fn(),
  enrollEnrichmentForAllRecipes: vi.fn(),
}));

vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/db/repositories/server-config", () => import("../mocks/server-config"));

vi.mock("@norish/db/repositories/recipes", () => ({
  getImageGenerationSweepCounts: mocks.getImageGenerationSweepCounts,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getAutomaticEnrichmentConfig: mocks.getAutomaticEnrichmentConfig,
  isImageGenerationConfigured: mocks.isImageGenerationConfigured,
  isAIEnabled: mocks.isAIEnabled,
  getRecipePermissionPolicy: mocks.getRecipePermissionPolicy,
}));

vi.mock("@norish/queue", () => ({
  enrollEnrichmentForAllRecipes: mocks.enrollEnrichmentForAllRecipes,
}));

vi.mock("@norish/auth/connection-tests", () => ({ testAIEndpoint: vi.fn() }));

vi.mock("@norish/shared-server/ai/providers/listing", () => ({
  listModels: vi.fn(),
  listTranscriptionModels: vi.fn(),
  ModelListingError: class ModelListingError extends Error {},
}));

vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

function createCaller(admin = true) {
  const ctx = createMockAdminContext(admin ? createMockAdminUser() : createMockUser());

  return aiConfigProcedures.createCaller(ctx as never);
}

const ALL_ON = {
  autoTagging: true,
  allergyDetection: true,
  autoCategorization: true,
  nutritionEstimation: true,
  recipeProvenance: true,
  ingredientLinking: true,
  imageGeneration: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  isUserServerAdmin.mockImplementation((userId: string) =>
    Promise.resolve(userId === createMockAdminUser().id)
  );
  mocks.getAutomaticEnrichmentConfig.mockResolvedValue(ALL_ON);
  mocks.isImageGenerationConfigured.mockResolvedValue(true);
  mocks.isAIEnabled.mockResolvedValue(true);
  mocks.getImageGenerationSweepCounts.mockResolvedValue({ eligible: 12, missingImage: 4 });
  mocks.enrollEnrichmentForAllRecipes.mockResolvedValue({ recipes: 12, queued: 30 });
});

describe("imageGenerationSweepCount", () => {
  it("names both numbers: gaps only by default, every eligible recipe with overwrite", async () => {
    await expect(createCaller().imageGenerationSweepCount()).resolves.toEqual({
      enabled: true,
      gapOnly: 4,
      overwrite: 12,
    });
  });

  it("reports the kind as off so the modal stays exactly as it is today", async () => {
    mocks.getAutomaticEnrichmentConfig.mockResolvedValue({ ...ALL_ON, imageGeneration: false });

    await expect(createCaller().imageGenerationSweepCount()).resolves.toEqual({ enabled: false });
    expect(mocks.getImageGenerationSweepCounts).not.toHaveBeenCalled();
  });

  it("counts zero when no image provider is configured: every origin would skip", async () => {
    mocks.isImageGenerationConfigured.mockResolvedValue(false);

    await expect(createCaller().imageGenerationSweepCount()).resolves.toEqual({
      enabled: true,
      gapOnly: 0,
      overwrite: 0,
    });
    expect(mocks.getImageGenerationSweepCounts).not.toHaveBeenCalled();
  });

  it("is admin-only", async () => {
    await expect(createCaller(false).imageGenerationSweepCount()).rejects.toThrow(
      /Server admin access required/i
    );
  });
});

describe("enrichAllRecipes", () => {
  it("refuses when AI is disabled, before queueing anything", async () => {
    mocks.isAIEnabled.mockResolvedValue(false);

    await expect(createCaller().enrichAllRecipes({ replaceExisting: false })).rejects.toMatchObject(
      { code: "PRECONDITION_FAILED" }
    );
    expect(mocks.enrollEnrichmentForAllRecipes).not.toHaveBeenCalled();
  });

  it("passes the overwrite choice through to the sweep", async () => {
    await expect(createCaller().enrichAllRecipes({ replaceExisting: true })).resolves.toEqual({
      recipes: 12,
      queued: 30,
    });
    expect(mocks.enrollEnrichmentForAllRecipes).toHaveBeenCalledWith(expect.anything(), {
      replaceExisting: true,
    });
  });
});
