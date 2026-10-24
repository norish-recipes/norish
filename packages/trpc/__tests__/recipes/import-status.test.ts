// @vitest-environment node

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { importStatusProcedure } from "@norish/trpc/routers/recipes/recipes";

import { canAccessResource } from "../mocks/permissions";
import {
  createMockAuthedContext,
  createMockHousehold,
  createMockRecipeDashboard,
  createMockUser,
} from "./test-utils";

const mocks = vi.hoisted(() => ({
  getJob: vi.fn(),
  getRecipePermissionPolicy: vi.fn(),
  dashboardRecipe: vi.fn(),
  findRecipeForViewer: vi.fn(),
}));

vi.mock("@norish/queue/registry", () => ({
  getQueues: vi.fn(() => ({
    recipeImport: {
      getJob: mocks.getJob,
    },
  })),
}));

vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: mocks.getRecipePermissionPolicy,
  isVideoParsingEnabled: vi.fn(),
}));

vi.mock("@norish/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/db")>();
  return {
    ...actual,
    dashboardRecipe: mocks.dashboardRecipe,
  };
});

vi.mock("@norish/trpc/routers/recipes/helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/trpc/routers/recipes/helpers")>();
  return {
    ...actual,
    findRecipeForViewer: mocks.findRecipeForViewer,
  };
});

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(),
  }),
  redactUrl: vi.fn((value: string) => value),
  trpcLogger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

const router = t.router({ importStatus: importStatusProcedure });

describe("importStatusProcedure", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;
  const RECIPE_ID = "123e4567-e89b-42d3-a456-426614174000";
  const EXISTING_ID = "223e4567-e89b-42d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
    mocks.getRecipePermissionPolicy.mockResolvedValue({ view: "household", edit: "household" });
    canAccessResource.mockResolvedValue(true);
  });

  function caller() {
    return t.createCallerFactory(router)(ctx);
  }

  it("returns active status and progress step when job is running", async () => {
    mocks.getJob.mockResolvedValue({
      id: RECIPE_ID,
      data: {
        recipeId: RECIPE_ID,
        url: "https://example.com/recipe",
        userId: mockUser.id,
        householdKey: mockHousehold.id,
      },
      getState: vi.fn().mockResolvedValue("active"),
      progress: { step: "parsing" },
    });

    const result = await caller().importStatus({ recipeId: RECIPE_ID });

    expect(result).toEqual({
      recipeId: RECIPE_ID,
      url: "https://example.com/recipe",
      status: "active",
      step: "parsing",
      error: null,
      recipe: null,
    });
  });

  it("returns waiting status when job is queued", async () => {
    mocks.getJob.mockResolvedValue({
      id: RECIPE_ID,
      data: {
        recipeId: RECIPE_ID,
        url: "https://example.com/recipe",
        userId: mockUser.id,
        householdKey: mockHousehold.id,
      },
      getState: vi.fn().mockResolvedValue("waiting"),
      progress: null,
    });

    const result = await caller().importStatus({ recipeId: RECIPE_ID });

    expect(result.status).toBe("waiting");
    expect(result.step).toBeNull();
  });

  it("returns completed status and recipe data when job finishes successfully", async () => {
    const mockRecipe = createMockRecipeDashboard({
      id: RECIPE_ID,
      name: "Delicious Pasta",
      description: "A great pasta dish",
      url: "https://example.com/recipe",
      image: "https://example.com/pasta.jpg",
      tags: [],
      categories: ["Dinner"],
    });

    mocks.getJob.mockResolvedValue({
      id: RECIPE_ID,
      data: {
        recipeId: RECIPE_ID,
        url: "https://example.com/recipe",
        userId: mockUser.id,
        householdKey: mockHousehold.id,
      },
      getState: vi.fn().mockResolvedValue("completed"),
      progress: { step: "saving" },
    });
    mocks.dashboardRecipe.mockResolvedValue(mockRecipe);

    const result = await caller().importStatus({ recipeId: RECIPE_ID });

    expect(result).toEqual({
      recipeId: RECIPE_ID,
      url: "https://example.com/recipe",
      status: "completed",
      step: "saving",
      error: null,
      recipe: mockRecipe,
    });
  });

  it("returns failed status and failure reason when job fails", async () => {
    mocks.getJob.mockResolvedValue({
      id: RECIPE_ID,
      data: {
        recipeId: RECIPE_ID,
        url: "https://example.com/recipe",
        userId: mockUser.id,
        householdKey: mockHousehold.id,
      },
      getState: vi.fn().mockResolvedValue("failed"),
      failedReason: "Failed to parse recipe from URL",
      progress: { step: "parsing" },
    });

    const result = await caller().importStatus({ recipeId: RECIPE_ID });

    expect(result).toEqual({
      recipeId: RECIPE_ID,
      url: "https://example.com/recipe",
      status: "failed",
      step: "parsing",
      error: "Failed to parse recipe from URL",
      recipe: null,
    });
  });

  it("answers not found for a job the viewer may not see", async () => {
    canAccessResource.mockResolvedValue(false);
    mocks.getJob.mockResolvedValue({
      id: RECIPE_ID,
      data: {
        recipeId: RECIPE_ID,
        url: "https://example.com/recipe",
        userId: "other-user",
        householdKey: "other-household",
      },
      getState: vi.fn().mockResolvedValue("active"),
    });
    mocks.findRecipeForViewer.mockResolvedValue(null);

    await expect(caller().importStatus({ recipeId: RECIPE_ID })).rejects.toThrow(
      "Import job or recipe not found"
    );
    expect(canAccessResource).toHaveBeenCalledWith(
      "view",
      ctx.user.id,
      "other-user",
      ctx.householdUserIds,
      ctx.isServerAdmin
    );
  });

  it("answers with the existing recipe when the URL was already imported", async () => {
    const existing = createMockRecipeDashboard({ id: EXISTING_ID, name: "Already here" });

    mocks.getJob.mockResolvedValue({
      id: RECIPE_ID,
      data: { recipeId: RECIPE_ID, url: "https://example.com/recipe", userId: mockUser.id },
      getState: vi.fn().mockResolvedValue("completed"),
      returnvalue: EXISTING_ID,
      progress: { step: "dedupe-check" },
    });
    mocks.dashboardRecipe.mockResolvedValue(existing);

    const result = await caller().importStatus({ recipeId: RECIPE_ID });

    expect(mocks.dashboardRecipe).toHaveBeenCalledWith(EXISTING_ID);
    expect(result.recipe).toEqual(existing);
  });

  it("falls back to database when job has already been purged from queue", async () => {
    const mockRecipe = createMockRecipeDashboard({
      id: RECIPE_ID,
      name: "Existing Recipe",
      url: "https://example.com/recipe",
      tags: [],
      categories: [],
    });

    mocks.getJob.mockResolvedValue(null);
    mocks.findRecipeForViewer.mockResolvedValue({
      id: RECIPE_ID,
      url: "https://example.com/recipe",
    });
    mocks.dashboardRecipe.mockResolvedValue(mockRecipe);

    const result = await caller().importStatus({ recipeId: RECIPE_ID });

    expect(result).toEqual({
      recipeId: RECIPE_ID,
      url: "https://example.com/recipe",
      status: "completed",
      step: null,
      error: null,
      recipe: mockRecipe,
    });
  });

  it("throws NOT_FOUND when job is not in queue and recipe not in database", async () => {
    mocks.getJob.mockResolvedValue(null);
    mocks.findRecipeForViewer.mockResolvedValue(null);

    await expect(caller().importStatus({ recipeId: RECIPE_ID })).rejects.toThrow(
      "Import job or recipe not found"
    );
  });

  it("waits for completion when wait parameter is provided", async () => {
    let callCount = 0;
    mocks.getJob.mockResolvedValue({
      id: RECIPE_ID,
      data: {
        recipeId: RECIPE_ID,
        url: "https://example.com/recipe",
        userId: mockUser.id,
        householdKey: mockHousehold.id,
      },
      getState: vi.fn().mockImplementation(async () => {
        callCount++;
        return callCount > 1 ? "completed" : "active";
      }),
      progress: { step: "saving" },
    });
    mocks.dashboardRecipe.mockResolvedValue(
      createMockRecipeDashboard({ id: RECIPE_ID, name: "Ready" })
    );

    const result = await caller().importStatus({ recipeId: RECIPE_ID, wait: 2 });

    expect(result.status).toBe("completed");
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it("reports the failure reason of a job that fails while waiting", async () => {
    const job = {
      id: RECIPE_ID,
      data: { recipeId: RECIPE_ID, url: "https://example.com/recipe", userId: mockUser.id },
      progress: { step: "parsing" },
    };

    mocks.getJob
      .mockResolvedValueOnce({ ...job, getState: vi.fn().mockResolvedValue("active") })
      .mockResolvedValue({
        ...job,
        getState: vi.fn().mockResolvedValue("failed"),
        failedReason: "Failed to parse recipe from URL",
      });

    const result = await caller().importStatus({ recipeId: RECIPE_ID, wait: 2 });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Failed to parse recipe from URL");
  });

  it("reads the recipe when the job leaves the queue while waiting", async () => {
    mocks.getJob
      .mockResolvedValueOnce({
        id: RECIPE_ID,
        data: { recipeId: RECIPE_ID, url: "https://example.com/recipe", userId: mockUser.id },
        getState: vi.fn().mockResolvedValue("active"),
      })
      .mockResolvedValue(undefined);
    mocks.findRecipeForViewer.mockResolvedValue({
      id: RECIPE_ID,
      url: "https://example.com/recipe",
    });
    mocks.dashboardRecipe.mockResolvedValue(createMockRecipeDashboard({ id: RECIPE_ID }));

    const result = await caller().importStatus({ recipeId: RECIPE_ID, wait: 2 });

    expect(result.status).toBe("completed");
  });
});
