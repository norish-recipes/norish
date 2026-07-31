// @vitest-environment node
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentEnrollment } from "@norish/shared/lib/recipe-enrichment";
import { ENRICHMENT_KINDS } from "@norish/shared/lib/recipe-enrichment";

import { recipesRouter } from "../../src/routers/recipes";
import { canAccessResource, isAIEnabled } from "../mocks/permissions";
import { getRecipeFull, getRecipeOwnerId } from "../mocks/recipes-repository";
import {
  createMockAuthedContext,
  createMockFullRecipe,
  createMockHousehold,
  createMockUser,
} from "./test-utils";

const mocked = vi.hoisted(() => ({
  enrichRecipe: vi.fn(),
  getRecipeEnrichmentStatus: vi.fn(),
}));

const { enrichRecipe, getRecipeEnrichmentStatus } = mocked;

vi.mock("@norish/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/db")>();
  const recipes = await import("../mocks/recipes-repository");

  return {
    ...actual,
    getRecipeFull: recipes.getRecipeFull,
    getRecipeOwnerId: recipes.getRecipeOwnerId,
  };
});

vi.mock("@norish/db/repositories/recipes", () => import("../mocks/recipes-repository"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/recipes/emitter", () => import("../mocks/recipe-emitter"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));

vi.mock("@norish/queue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/queue")>();

  return { ...actual, enrichRecipe: mocked.enrichRecipe };
});

vi.mock("@norish/queue/enrichment/status", () => ({
  getRecipeEnrichmentStatus: mocked.getRecipeEnrichmentStatus,
}));

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

const mockUser = createMockUser();
const mockHousehold = createMockHousehold();
let ctx: ReturnType<typeof createMockAuthedContext>;

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";

function caller() {
  return t.createCallerFactory(recipesRouter)(ctx);
}

function queued(): RecipeEnrichmentEnrollment[] {
  return [{ kind: "auto-tagging", status: "queued", jobId: "enrich_auto-tagging_recipe-1" }];
}

beforeEach(() => {
  vi.clearAllMocks();
  ctx = createMockAuthedContext(mockUser, mockHousehold);
  isAIEnabled.mockResolvedValue(true);
  canAccessResource.mockResolvedValue(true);
  getRecipeOwnerId.mockResolvedValue(mockUser.id);
  getRecipeFull.mockResolvedValue(createMockFullRecipe({ id: RECIPE_ID }));
  enrichRecipe.mockResolvedValue(queued());
  getRecipeEnrichmentStatus.mockResolvedValue({ recipeId: RECIPE_ID, kinds: [] });
});

describe("requestEnrichment", () => {
  it("enrolls exactly the requested kind, as a manual run", async () => {
    const result = await caller().requestEnrichment({ recipeId: RECIPE_ID, kind: "auto-tagging" });

    expect(result).toEqual({ success: true });
    expect(enrichRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ recipeId: RECIPE_ID, userId: mockUser.id }),
      { origin: "manual", kind: "auto-tagging" }
    );
  });

  it("refuses when AI is globally disabled", async () => {
    isAIEnabled.mockResolvedValue(false);

    await expect(
      caller().requestEnrichment({ recipeId: RECIPE_ID, kind: "auto-tagging" })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(enrichRecipe).not.toHaveBeenCalled();
  });

  it("refuses an unknown recipe", async () => {
    getRecipeFull.mockResolvedValue(null);

    await expect(
      caller().requestEnrichment({ recipeId: RECIPE_ID, kind: "auto-tagging" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires edit permission, not merely view", async () => {
    getRecipeOwnerId.mockResolvedValue("someone-else");
    canAccessResource.mockResolvedValue(false);

    await expect(
      caller().requestEnrichment({ recipeId: RECIPE_ID, kind: "auto-tagging" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(enrichRecipe).not.toHaveBeenCalled();
    expect(canAccessResource).toHaveBeenCalledWith(
      "edit",
      mockUser.id,
      "someone-else",
      expect.anything(),
      expect.anything()
    );
  });

  it("rejects a duplicate while the same kind is already running", async () => {
    enrichRecipe.mockResolvedValue([
      { kind: "auto-tagging", status: "duplicate", existingJobId: "existing" },
    ]);

    await expect(
      caller().requestEnrichment({ recipeId: RECIPE_ID, kind: "auto-tagging" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("reports an enrollment failure immediately, so the requester knows it did not start", async () => {
    enrichRecipe.mockResolvedValue([
      { kind: "auto-tagging", status: "failed-to-queue", error: "redis is down" },
    ]);

    await expect(
      caller().requestEnrichment({ recipeId: RECIPE_ID, kind: "auto-tagging" })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it.each([
    ["insufficient-input", "does not have enough information"],
    ["no-household-allergies", "No allergies configured"],
  ])("explains a %s skip", async (reason, message) => {
    enrichRecipe.mockResolvedValue([{ kind: "allergy-detection", status: "skipped", reason }]);

    await expect(
      caller().requestEnrichment({ recipeId: RECIPE_ID, kind: "allergy-detection" })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining(message),
    });
  });

  it("accepts every kind in the shared vocabulary", async () => {
    for (const kind of ENRICHMENT_KINDS) {
      await expect(caller().requestEnrichment({ recipeId: RECIPE_ID, kind })).resolves.toEqual({
        success: true,
      });
    }
  });

  it("rejects a kind outside the vocabulary before touching the coordinator", async () => {
    // The wire can carry any string; the router's zod schema is the gate under
    // test, so the payload bypasses compile-time checking on purpose.
    const outsideVocabulary = { recipeId: RECIPE_ID, kind: "run-everything" } as never;

    await expect(caller().requestEnrichment(outsideVocabulary)).rejects.toBeInstanceOf(TRPCError);
    expect(enrichRecipe).not.toHaveBeenCalled();
  });
});

describe("enrichmentStatus", () => {
  it("returns the combined status for a recipe the caller may view", async () => {
    const status = { recipeId: RECIPE_ID, kinds: [] };

    getRecipeEnrichmentStatus.mockResolvedValue(status);

    await expect(caller().enrichmentStatus({ recipeId: RECIPE_ID })).resolves.toEqual(status);
  });

  it("does not disclose the status of a recipe the caller cannot view", async () => {
    getRecipeOwnerId.mockResolvedValue("someone-else");
    canAccessResource.mockResolvedValue(false);

    await expect(caller().enrichmentStatus({ recipeId: RECIPE_ID })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(getRecipeEnrichmentStatus).not.toHaveBeenCalled();
  });
});
