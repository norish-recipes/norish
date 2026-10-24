// @vitest-environment node
/**
 * Ingredient Linking worker.
 *
 * The worker owns one AI request, the semantic view it sends, one repository
 * call, and the lifecycle it publishes — and nothing else. In particular it
 * owns no queries: the drizzle handle below throws on any access, so a worker
 * that composed one would fail these tests rather than quietly cross the
 * boundary. Gap-filling and replacing both live in the repository write; what
 * is pinned here is which of the two the worker asks for, and that clearing
 * links counts as a change even when the claim landed on no step.
 */

import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";

const mocks = vi.hoisted(() => ({
  getRecipeFull: vi.fn(),
  publishLifecycle: vi.fn(),
  publishRecipeUpdated: vi.fn(),
  reportStep: vi.fn(),
  writeInferredStepIngredients: vi.fn(),
  inferStepIngredients: vi.fn(),
}));

vi.mock("@norish/db", () => ({ getRecipeFull: mocks.getRecipeFull }));

vi.mock("@norish/db/drizzle", () => ({
  get db(): never {
    throw new Error("The worker must not hold a database handle");
  },
}));

vi.mock("@norish/db/repositories/recipe-enrichment", () => ({
  writeInferredStepIngredients: mocks.writeInferredStepIngredients,
}));

vi.mock("@norish/shared-server/ai/enrichment/ingredient-linking-inferrer", () => ({
  inferStepIngredients: mocks.inferStepIngredients,
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("../../src/enrichment/announce", () => ({
  publishEnrichmentLifecycle: mocks.publishLifecycle,
  publishEnrichmentRecipeUpdated: mocks.publishRecipeUpdated,
}));

vi.mock("../../src/job-steps", () => ({ reportStep: mocks.reportStep }));

const { processIngredientLinkingJob, toLinkableRecipe } =
  await import("../../src/ingredient-linking/worker");

const INFERENCE = {
  links: [
    {
      stepOrder: 1,
      refs: [
        { ingredientOrder: 1, share: 1, order: 0 },
        { ingredientOrder: 2, share: 0.5, order: 1 },
      ],
    },
  ],
};

/** Dual-system recipe: the semantic view must read the active system only. */
const RECIPE = {
  id: "recipe-1",
  name: "Spiced Stew",
  description: null,
  systemUsed: "metric",
  recipeIngredients: [
    { ingredientName: "# Spices", amount: null, unit: null, systemUsed: "metric", order: 0 },
    { ingredientName: "salt", amount: 5, unit: "g", systemUsed: "metric", order: 1 },
    { ingredientName: "water", amount: 50, unit: "ml", systemUsed: "metric", order: 2 },
    { ingredientName: "salt", amount: 0.2, unit: "tsp", systemUsed: "us", order: 1 },
    { ingredientName: "water", amount: 0.25, unit: "cup", systemUsed: "us", order: 2 },
  ],
  steps: [
    { step: "# Cooking", systemUsed: "metric", order: 0 },
    { step: "Add the spices and half the water.", systemUsed: "metric", order: 1 },
    { step: "Add the spices and half the water.", systemUsed: "us", order: 1 },
  ],
};

function jobFor(overrides: Partial<RecipeEnrichmentJobData> = {}): Job<RecipeEnrichmentJobData> {
  const data: RecipeEnrichmentJobData = {
    recipeId: "recipe-1",
    kind: "ingredient-linking",
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: ["user-1"],
    origin: "automatic",
    ...overrides,
  };

  return {
    id: "job-1",
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as Job<RecipeEnrichmentJobData>;
}

beforeEach(() => {
  mocks.getRecipeFull.mockResolvedValue(RECIPE);
  mocks.writeInferredStepIngredients.mockResolvedValue({ filled: 1, cleared: 0 });
  mocks.inferStepIngredients.mockResolvedValue(INFERENCE);
});

describe("toLinkableRecipe", () => {
  it("sends one semantic view: the active system's rows, orders as keys", () => {
    const view = toLinkableRecipe(RECIPE as never);

    expect(view.ingredients.map((line) => line.order)).toEqual([0, 1, 2]);
    expect(view.ingredients[1]).toEqual({
      order: 1,
      text: "5 g salt",
      amount: 5,
      isHeading: false,
    });
    expect(view.steps.map((step) => step.order)).toEqual([0, 1]);
  });

  it("marks heading rows so they are never offered", () => {
    const view = toLinkableRecipe(RECIPE as never);

    expect(view.ingredients[0]).toMatchObject({ isHeading: true });
    expect(view.steps[0]).toMatchObject({ isHeading: true });
  });
});

describe("processIngredientLinkingJob", () => {
  it("persists a claim through the gap-filling repository write and reports success", async () => {
    await processIngredientLinkingJob(jobFor());

    expect(mocks.writeInferredStepIngredients).toHaveBeenCalledWith(
      "recipe-1",
      INFERENCE.links,
      "gap-fill"
    );
    expect(mocks.publishLifecycle.mock.calls.map(([, state]) => state)).toEqual([
      "processing",
      "succeeded",
    ]);
  });

  it("emits the canonical updated recipe when links were written", async () => {
    await processIngredientLinkingJob(jobFor());

    expect(mocks.publishRecipeUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "ingredient-linking" }),
      RECIPE
    );
  });

  it("treats an empty claim as an unchanged success, not a failure", async () => {
    mocks.inferStepIngredients.mockResolvedValue({ links: [] });

    await processIngredientLinkingJob(jobFor());

    expect(mocks.writeInferredStepIngredients).not.toHaveBeenCalled();
    expect(mocks.publishRecipeUpdated).not.toHaveBeenCalled();
    expect(mocks.publishLifecycle.mock.calls.map(([, state]) => state)).toEqual([
      "processing",
      "succeeded",
    ]);
  });

  it("never reaches the write with an empty claim, so a refresh cannot clear on nothing", async () => {
    mocks.inferStepIngredients.mockResolvedValue({ links: [] });

    await processIngredientLinkingJob(jobFor({ replaceExisting: true }));

    expect(mocks.writeInferredStepIngredients).not.toHaveBeenCalled();
  });

  it("stays quiet when every claimed step already had links", async () => {
    // The write applied to zero steps: a person's own links were there first.
    mocks.writeInferredStepIngredients.mockResolvedValue({ filled: 0, cleared: 0 });

    await processIngredientLinkingJob(jobFor());

    expect(mocks.publishRecipeUpdated).not.toHaveBeenCalled();
    expect(mocks.publishLifecycle.mock.calls.map(([, state]) => state)).toContain("succeeded");
  });

  it("asks for a replacing write when the run is an administrator's refresh", async () => {
    await processIngredientLinkingJob(jobFor({ replaceExisting: true }));

    expect(mocks.writeInferredStepIngredients).toHaveBeenCalledWith(
      "recipe-1",
      INFERENCE.links,
      "replace"
    );
  });

  it("keeps a manual rerun gap-filling, because that action exists to fill in the rest", async () => {
    // Unlike every other kind, "Link Ingredients to Steps" is invoked to
    // complete a person's own links, so it must never delete them.
    await processIngredientLinkingJob(jobFor({ origin: "manual", requestedByUserId: "user-1" }));

    expect(mocks.writeInferredStepIngredients).toHaveBeenCalledWith(
      "recipe-1",
      INFERENCE.links,
      "gap-fill"
    );
  });

  it("counts a write that only cleared links as a change", async () => {
    // Every ref was dropped, but the refresh emptied the steps it cleared, so
    // clients that are still rendering those links must be told.
    mocks.writeInferredStepIngredients.mockResolvedValue({ filled: 0, cleared: 2 });

    await processIngredientLinkingJob(jobFor({ replaceExisting: true }));

    expect(mocks.publishRecipeUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "ingredient-linking" }),
      RECIPE
    );
  });

  it("throws on a transient AI failure so BullMQ retries it", async () => {
    mocks.inferStepIngredients.mockRejectedValue(new Error("provider timed out"));

    await expect(processIngredientLinkingJob(jobFor())).rejects.toThrow("provider timed out");
    expect(mocks.writeInferredStepIngredients).not.toHaveBeenCalled();
  });
});
