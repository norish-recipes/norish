// @vitest-environment node
/** Allergy detection asks about the recipe's household's allergies as the job runs (ADR-0043). */

import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";

const mocks = vi.hoisted(() => ({
  getRecipeFull: vi.fn(),
  getHouseholdAllergyNames: vi.fn(),
  appendRecipeTags: vi.fn(),
  detectAllergiesInRecipe: vi.fn(),
}));

vi.mock("@norish/db", () => ({
  getRecipeFull: mocks.getRecipeFull,
  getHouseholdAllergyNames: mocks.getHouseholdAllergyNames,
}));
vi.mock("@norish/db/repositories/tags", () => ({ appendRecipeTags: mocks.appendRecipeTags }));
vi.mock("@norish/shared-server/ai/enrichment/allergy-detector", () => ({
  detectAllergiesInRecipe: mocks.detectAllergiesInRecipe,
}));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("../../src/enrichment/announce", () => ({
  publishEnrichmentLifecycle: vi.fn(),
  publishEnrichmentRecipeUpdated: vi.fn(),
}));
vi.mock("../../src/job-steps", () => ({ reportStep: vi.fn() }));

const { processAllergyDetectionJob } = await import("../../src/allergy-detection/worker");

function job(): Job<RecipeEnrichmentJobData> {
  return {
    id: "job-1",
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      recipeId: "recipe-1",
      runId: "run-1",
      runSequence: 1,
      kind: "allergy-detection",
      userId: "owner-1",
      // Queued before the recipe's Owner left this household.
      householdId: "left-household",
      origin: "automatic",
    },
  } as Job<RecipeEnrichmentJobData>;
}

describe("processAllergyDetectionJob", () => {
  beforeEach(() => {
    mocks.getRecipeFull.mockResolvedValue({
      id: "recipe-1",
      userId: "owner-1",
      householdId: "owner-household",
      name: "Satay",
      description: null,
      recipeIngredients: [{ ingredientName: "peanut" }],
    });
    mocks.getHouseholdAllergyNames.mockResolvedValue(["Peanuts"]);
    mocks.detectAllergiesInRecipe.mockResolvedValue(["Peanuts"]);
    mocks.appendRecipeTags.mockResolvedValue({ added: ["Peanuts"], allTags: ["Peanuts"] });
  });

  it("reads the allergies of the household the recipe is in now", async () => {
    await processAllergyDetectionJob(job());

    expect(mocks.getHouseholdAllergyNames).toHaveBeenCalledWith("owner-household");
    expect(mocks.appendRecipeTags).toHaveBeenCalledWith("recipe-1", ["Peanuts"]);
  });
});
