// @vitest-environment node
/**
 * Auto-categorization worker: the categoriser picks from the recipe owner's
 * household list (ADR-0040), whoever asked for the run.
 */

import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";

const mocks = vi.hoisted(() => ({
  getRecipeFull: vi.fn(),
  getHouseholdMemberIds: vi.fn(),
  listCategoryNamesForUsers: vi.fn(),
  replaceRecipeCategories: vi.fn(),
  categorizeRecipe: vi.fn(),
}));

vi.mock("@norish/db", () => ({ getRecipeFull: mocks.getRecipeFull }));
vi.mock("@norish/db/repositories/households", () => ({
  getHouseholdMemberIds: mocks.getHouseholdMemberIds,
}));
vi.mock("@norish/db/repositories/categories", () => ({
  listCategoryNamesForUsers: mocks.listCategoryNamesForUsers,
}));
vi.mock("@norish/db/repositories/recipe-enrichment", () => ({
  replaceRecipeCategories: mocks.replaceRecipeCategories,
}));
vi.mock("@norish/shared-server/ai/enrichment/auto-categorizer", () => ({
  categorizeRecipe: mocks.categorizeRecipe,
}));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("../../src/enrichment/announce", () => ({
  publishEnrichmentLifecycle: vi.fn(),
  publishEnrichmentRecipeUpdated: vi.fn(),
}));
vi.mock("../../src/job-steps", () => ({ reportStep: vi.fn() }));

const { processAutoCategorizationJob } = await import("../../src/auto-categorization/worker");

const HOUSEHOLD = ["Breakfast", "Lunch", "Dinner", "Snack", "Drinks"];

function job(): Job<RecipeEnrichmentJobData> {
  return {
    id: "job-1",
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      recipeId: "recipe-1",
      runId: "run-1",
      runSequence: 1,
      kind: "auto-categorization",
      // An administrator's run: the owner's household decides the list, not theirs.
      userId: "admin-1",
      householdKey: "admin-household",
      householdUserIds: null,
      origin: "manual",
      requestedByUserId: "admin-1",
    },
  } as Job<RecipeEnrichmentJobData>;
}

describe("processAutoCategorizationJob", () => {
  beforeEach(() => {
    mocks.getRecipeFull.mockResolvedValue({
      id: "recipe-1",
      userId: "owner-1",
      name: "Margarita",
      description: null,
      recipeIngredients: [{ ingredientName: "tequila" }],
    });
    mocks.getHouseholdMemberIds.mockResolvedValue(["owner-1", "owner-2"]);
    mocks.listCategoryNamesForUsers.mockResolvedValue(HOUSEHOLD);
    mocks.categorizeRecipe.mockResolvedValue(["Drinks"]);
    mocks.replaceRecipeCategories.mockResolvedValue(true);
  });

  it("categorizes from the recipe owner's household list and saves the pick", async () => {
    await processAutoCategorizationJob(job());

    expect(mocks.getHouseholdMemberIds).toHaveBeenCalledWith("owner-1");
    expect(mocks.listCategoryNamesForUsers).toHaveBeenCalledWith(["owner-1", "owner-2"]);
    expect(mocks.categorizeRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Margarita" }),
      HOUSEHOLD
    );
    expect(mocks.replaceRecipeCategories).toHaveBeenCalledWith("recipe-1", ["Drinks"], "replace");
  });
});
