// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockAuthedContext, createMockFullRecipe, createMockHousehold, createMockUser } from "./test-utils";

const assertRecipeAccessMock = vi.hoisted(() => vi.fn());
const createRecipeShareMock = vi.hoisted(() => vi.fn());
const deleteRecipeShareMock = vi.hoisted(() => vi.fn());
const getActiveRecipeShareByTokenMock = vi.hoisted(() => vi.fn());
const getPublicRecipeViewMock = vi.hoisted(() => vi.fn());
const getRecipeFullMock = vi.hoisted(() => vi.fn());
const getRecipeShareByIdMock = vi.hoisted(() => vi.fn());
const getRecipeSharesByUserIdMock = vi.hoisted(() => vi.fn());
const getRecipeShareStatusMock = vi.hoisted(() => vi.fn());
const revokeRecipeShareMock = vi.hoisted(() => vi.fn());
const updateRecipeShareMock = vi.hoisted(() => vi.fn());
const getCachedHouseholdForUserMock = vi.hoisted(() => vi.fn());
const isUserServerAdminMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/routers/recipes/recipes", () => ({
  assertRecipeAccess: assertRecipeAccessMock,
}));

vi.mock("@norish/db/repositories/recipe-shares", () => ({
  createRecipeShare: createRecipeShareMock,
  deleteRecipeShare: deleteRecipeShareMock,
  getActiveRecipeShareByToken: getActiveRecipeShareByTokenMock,
  getPublicRecipeView: getPublicRecipeViewMock,
  getRecipeShareById: getRecipeShareByIdMock,
  getRecipeShareStatus: getRecipeShareStatusMock,
  getRecipeSharesByUserId: getRecipeSharesByUserIdMock,
  revokeRecipeShare: revokeRecipeShareMock,
  updateRecipeShare: updateRecipeShareMock,
}));

vi.mock("@norish/db/repositories/recipes", () => ({
  getRecipeFull: getRecipeFullMock,
}));

vi.mock("@norish/db", () => ({
  getCachedHouseholdForUser: getCachedHouseholdForUserMock,
  isUserServerAdmin: isUserServerAdminMock,
}));

const { recipeSharesProcedures } = await import("../../src/routers/recipes/shares");

describe("recipe share procedures", () => {
  const user = createMockUser();
  const household = createMockHousehold();
  const recipeId = "123e4567-e89b-12d3-a456-426614174000";
  const shareId = "123e4567-e89b-12d3-a456-426614174001";
  const authedCtx = {
    ...createMockAuthedContext(user, household),
    connectionId: null,
    multiplexer: null,
    operationId: null,
  };
  const publicCtx = {
    user: null,
    household: null,
    connectionId: null,
    multiplexer: null,
    operationId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isUserServerAdminMock.mockResolvedValue(false);
    getCachedHouseholdForUserMock.mockResolvedValue(household);
    getRecipeShareStatusMock.mockReturnValue("active");
  });

  it("creates a share after enforcing recipe edit access", async () => {
    const caller = recipeSharesProcedures.createCaller(authedCtx as never);

    assertRecipeAccessMock.mockResolvedValue(undefined);
    createRecipeShareMock.mockResolvedValue({
      id: shareId,
      userId: user.id,
      recipeId,
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      status: "active",
      url: "/share/token-1",
    });

    const result = await caller.shareCreate({ recipeId, expiresIn: "forever" });

    expect(assertRecipeAccessMock).toHaveBeenCalledWith(authedCtx, recipeId, "edit");
    expect(createRecipeShareMock).toHaveBeenCalledWith(user.id, {
      recipeId,
      expiresIn: "forever",
    });
    expect(result.url).toBe("/share/token-1");
  });

  it("returns the public recipe for a valid anonymous token", async () => {
    const caller = recipeSharesProcedures.createCaller(publicCtx as never);
    const recipe = createMockFullRecipe({ id: recipeId });

    getActiveRecipeShareByTokenMock.mockResolvedValue({
      id: shareId,
      userId: user.id,
      recipeId,
      tokenHash: "hashed",
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 2,
    });
    getRecipeFullMock.mockResolvedValue(recipe);
    getPublicRecipeViewMock.mockResolvedValue({
      name: recipe.name,
      description: recipe.description,
      notes: recipe.notes ?? null,
      url: recipe.url,
      image: `/share/valid-token/media/cover.jpg`,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      totalMinutes: recipe.totalMinutes,
      systemUsed: recipe.systemUsed,
      calories: recipe.calories,
      fat: recipe.fat,
      carbs: recipe.carbs,
      protein: recipe.protein,
      categories: recipe.categories,
      tags: [{ name: "dinner" }],
      recipeIngredients: [
        {
          ingredientName: "Flour",
          amount: 200,
          unit: "g",
          systemUsed: "metric",
          order: 0,
        },
      ],
      steps: [{ step: "Mix", systemUsed: "metric", order: 0, images: [] }],
      author: { name: "Test User", image: null },
      images: [],
      videos: [],
    });

    const result = await caller.getShared({ token: "valid-token" });

    expect(getActiveRecipeShareByTokenMock).toHaveBeenCalledWith("valid-token", {
      touchLastAccessedAt: true,
    });
    expect(getRecipeFullMock).toHaveBeenCalledWith(recipeId);
    expect(getPublicRecipeViewMock).toHaveBeenCalledWith(recipeId, "valid-token");
    expect(result.image).toBe("/share/valid-token/media/cover.jpg");
  });

  it("rejects invalid, expired, and revoked public tokens with the same not-found error", async () => {
    const caller = recipeSharesProcedures.createCaller(publicCtx as never);

    getActiveRecipeShareByTokenMock.mockResolvedValue(null);

    await expect(caller.getShared({ token: "invalid-token" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.getShared({ token: "expired-token" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.getShared({ token: "revoked-token" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not allow a user to manage another user's share", async () => {
    const caller = recipeSharesProcedures.createCaller(authedCtx as never);

    getRecipeShareByIdMock.mockResolvedValue({
      id: shareId,
      userId: "other-user",
      recipeId,
      tokenHash: "hashed",
      expiresAt: null,
      revokedAt: null,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });

    await expect(caller.shareGet({ id: shareId })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(assertRecipeAccessMock).not.toHaveBeenCalled();
  });
});
