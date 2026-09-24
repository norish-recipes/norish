import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import type { FullRecipeDTO } from "@norish/shared/contracts";

const mocks = vi.hoisted(() => ({
  publishRecipe: vi.fn(async () => undefined),
  publishEnrichment: vi.fn(async () => undefined),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "household" }),
}));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("@norish/shared-server/realtime/recipe-enrichment", () => ({
  recipeEnrichment: { publish: mocks.publishEnrichment },
}));
vi.mock("@norish/shared-server/realtime/recipes", () => ({
  recipes: { publish: mocks.publishRecipe },
}));

const { announceUsableRecipe, publishEnrichmentLifecycle, publishEnrichmentRecipeUpdated } =
  await import("../../src/enrichment/announce");

const data: RecipeEnrichmentJobData = {
  recipeId: "recipe-1",
  runId: "run-1",
  runSequence: 1,
  kind: "auto-tagging",
  userId: "user-1",
  householdKey: "household-1",
  householdUserIds: ["user-1"],
  origin: "manual",
  requestedByUserId: "user-1",
};

describe("publishEnrichmentLifecycle", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes requester identity only on a manual terminal failure", async () => {
    await publishEnrichmentLifecycle(data, "queued");
    await publishEnrichmentLifecycle(data, "failed");

    expect(mocks.publishRecipe.mock.calls[0]?.[1]).toEqual({
      recipeId: "recipe-1",
      runId: "run-1",
      runSequence: 1,
      kind: "auto-tagging",
      state: "queued",
      origin: "manual",
    });
    expect(mocks.publishRecipe.mock.calls[1]?.[1]).toEqual({
      recipeId: "recipe-1",
      runId: "run-1",
      runSequence: 1,
      kind: "auto-tagging",
      state: "failed",
      origin: "manual",
      requestedByUserId: "user-1",
    });
  });
});

describe("publishEnrichmentRecipeUpdated", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks the canonical update as enrichment-originated", async () => {
    const recipe = { id: "recipe-1" } as FullRecipeDTO;

    await publishEnrichmentRecipeUpdated(data, recipe);

    expect(mocks.publishRecipe).toHaveBeenCalledWith(
      "updated",
      { recipe, source: "enrichment" },
      { viewPolicy: "household", userId: "user-1", householdKey: "household-1" }
    );
  });
});

describe("announceUsableRecipe", () => {
  beforeEach(() => vi.clearAllMocks());

  const context = { userId: "user-1", householdKey: "household-1", householdUserIds: ["user-1"] };

  it("announces a genuinely new recipe on the internal channel", async () => {
    await announceUsableRecipe({ status: "inserted", recipeId: "recipe-1" }, context);

    expect(mocks.publishEnrichment).toHaveBeenCalledWith(
      "recipeBecameUsable",
      { recipeId: "recipe-1", ...context },
      undefined
    );
  });

  it("stays quiet for an import that resolved to an existing recipe", async () => {
    await announceUsableRecipe({ status: "existing", recipeId: "recipe-1" }, context);
    await announceUsableRecipe(null, context);

    expect(mocks.publishEnrichment).not.toHaveBeenCalled();
  });
});
